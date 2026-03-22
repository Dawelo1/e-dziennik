import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css';
import LoadingScreen from '../users/LoadingScreen';
import {
	FaMoneyBillWave,
	FaSyncAlt,
	FaFileInvoiceDollar,
	FaPlus,
	FaSearch,
	FaEdit,
	FaTrash,
	FaSave,
	FaExclamationTriangle,
	FaTrashAlt,
} from 'react-icons/fa';

const formatDate = (value) => {
	if (!value) return '-';
	return new Date(value).toLocaleDateString('pl-PL');
};

const formatAmount = (value) => `${Number(value || 0).toFixed(2)} zł`;
const getTodayIsoDate = () => new Date().toISOString().split('T')[0];
const ALL_CHILDREN_OPTION_VALUE = '__all__';

const getDateSearchValues = (value) => {
	if (!value) return [];
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return [String(value).toLowerCase()];

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return [
		`${year}-${month}-${day}`.toLowerCase(),
		`${day}-${month}-${year}`.toLowerCase(),
		`${day}.${month}.${year}`.toLowerCase(),
		date.toLocaleDateString('pl-PL').toLowerCase(),
	];
};

const toDateInputValue = (value) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const shortenText = (value, maxLength = 10) => {
	const text = String(value || '');
	if (!text) return '-';
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}…`;
};

const frequencyLabel = (value) => {
	if (value === 'weekly') return 'Co tydzień';
	if (value === 'monthly') return 'Co miesiąc';
	if (value === 'yearly') return 'Co rok';
	return value || '-';
};

const PaymentsTable = ({ items, onEdit, onDelete, sortField, getSortArrow, onSortChange }) => {
	if (!items.length) {
		return <p className="text-center">Brak płatności w tej sekcji.</p>;
	}

	return (
		<table className="custom-table">
			<thead>
				<tr>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onSortChange('child')}
						>
							Dziecko <span className="sort-arrow">{getSortArrow('child')}</span>
						</button>
					</th>
					<th>Opis</th>
					<th>Tytuł przelewu</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onSortChange('amount')}
						>
							Kwota <span className="sort-arrow">{getSortArrow('amount')}</span>
						</button>
					</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onSortChange('added')}
						>
							Dodano <span className="sort-arrow">{getSortArrow('added')}</span>
						</button>
					</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onSortChange('paid')}
						>
							Zapłacono <span className="sort-arrow">{getSortArrow('paid')}</span>
						</button>
					</th>
					<th className="actions-header">Akcje</th>
				</tr>
			</thead>
			<tbody>
				{items.map((payment) => (
					<tr key={payment.id}>
						<td>{payment.child_name || '-'}</td>
						<td title={payment.description || '-'}>{shortenText(payment.description, 10)}</td>
						<td>{payment.payment_title || '-'}</td>
						<td>{formatAmount(payment.amount)}</td>
						<td>{formatDate(payment.created_at)}</td>
						<td>{payment.payment_date ? formatDate(payment.payment_date) : '-'}</td>
						<td className="actions-cell">
							<button className="action-icon-btn edit" onClick={() => onEdit(payment)} title="Edytuj płatność">
								<FaEdit />
							</button>
							<button className="action-icon-btn delete" onClick={() => onDelete(payment)} title="Usuń płatność">
								<FaTrash />
							</button>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

const RecurringTemplatesTable = ({ items, onEdit, onDelete, recurringSortField, getRecurringSortArrow, onRecurringSortChange }) => {
	if (!items.length) {
		return <p className="text-center">Brak wzorów płatności cyklicznych.</p>;
	}

	return (
		<table className="custom-table">
			<thead>
				<tr>
					<th>Dzieci</th>
					<th>Opis wzoru</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onRecurringSortChange('amount')}
						>
							Kwota <span className="sort-arrow">{getRecurringSortArrow('amount')}</span>
						</button>
					</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onRecurringSortChange('frequency')}
						>
							Częstotliwość <span className="sort-arrow">{getRecurringSortArrow('frequency')}</span>
						</button>
					</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onRecurringSortChange('next_payment_date')}
						>
							Następna płatność <span className="sort-arrow">{getRecurringSortArrow('next_payment_date')}</span>
						</button>
					</th>
					<th>
						<button
							type="button"
							className="sortable-header-btn"
							onClick={() => onRecurringSortChange('status')}
						>
							Status wzoru <span className="sort-arrow">{getRecurringSortArrow('status')}</span>
						</button>
					</th>
					<th className="actions-header">Akcje</th>
				</tr>
			</thead>
			<tbody>
				{items.map((template) => (
					<tr key={template.id}>
						<td>{template.child_names_text || '-'}</td>
						<td title={template.description || '-'}>{shortenText(template.description, 10)}</td>
						<td>{formatAmount(template.amount)}</td>
						<td>{frequencyLabel(template.frequency)}</td>
						<td>{formatDate(template.next_payment_date)}</td>
						<td>
							<span className={`role-badge ${template.is_active ? 'recurring-active' : 'recurring-inactive'}`}>
								{template.is_active ? 'Aktywny' : 'Nieaktywny'}
							</span>
						</td>
						<td className="actions-cell">
							<button className="action-icon-btn edit" onClick={() => onEdit(template)} title="Edytuj wzór">
								<FaEdit />
							</button>
							<button className="action-icon-btn delete" onClick={() => onDelete(template)} title="Usuń wzór">
								<FaTrash />
							</button>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

const DirectorPayments = () => {
  const [searchParams] = useSearchParams();
  const debtMode = searchParams.get('debt') === '1';

	const initialOneTimeForm = {
		child: '',
		amount: '',
		description: '',
		payment_title: '',
		payment_date: '',
	};

	const initialRecurringForm = {
		children: [],
		amount: '',
		description: '',
		frequency: 'monthly',
		next_payment_date: getTodayIsoDate(),
		is_active: true,
	};

	const [children, setChildren] = useState([]);
	const [payments, setPayments] = useState([]);
	const [recurringTemplates, setRecurringTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [viewMode, setViewMode] = useState('one-time');
	const [searchQuery, setSearchQuery] = useState('');
	const [sortField, setSortField] = useState(debtMode ? 'paid' : 'added');
	const [sortDirection, setSortDirection] = useState(debtMode ? 'asc' : 'desc');
	const [recurringSortField, setRecurringSortField] = useState('next_payment_date');
	const [recurringSortDirection, setRecurringSortDirection] = useState('asc');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [editingOneTime, setEditingOneTime] = useState(null);
	const [editingRecurring, setEditingRecurring] = useState(null);
	const [oneTimeForm, setOneTimeForm] = useState(initialOneTimeForm);
	const [recurringForm, setRecurringForm] = useState(initialRecurringForm);
	const [formError, setFormError] = useState('');
	const [actionError, setActionError] = useState('');

	const isRecurringView = viewMode === 'recurring';

	const parseApiError = (err, fallback) => {
		const responseData = err?.response?.data;
		if (typeof responseData === 'string' && responseData.trim()) return responseData;
		if (responseData && typeof responseData === 'object') {
			const first = Object.values(responseData).flat()[0];
			if (first) return String(first);
		}
		return fallback;
	};

	const fetchData = async () => {
		const [childrenResponse, paymentsResponse, recurringResponse] = await Promise.all([
			axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()),
			axios.get('http://127.0.0.1:8000/api/payments/', getAuthHeaders()),
			axios.get('http://127.0.0.1:8000/api/recurring-payments/', getAuthHeaders()),
		]);

		const sortedPayments = [...paymentsResponse.data].sort(
			(a, b) => new Date(`${b.created_at}`) - new Date(`${a.created_at}`)
		);

		const sortedRecurring = [...recurringResponse.data].sort(
			(a, b) => new Date(`${a.next_payment_date}`) - new Date(`${b.next_payment_date}`)
		);

		setChildren(childrenResponse.data);
		setPayments(sortedPayments);
		setRecurringTemplates(sortedRecurring);
	};

	useEffect(() => {
		const loadInitialData = async () => {
			try {
				await fetchData();
			} catch (err) {
				console.error('Błąd pobierania płatności:', err);
			} finally {
				setLoading(false);
			}
		};

		loadInitialData();
	}, []);

	useEffect(() => {
		if (!debtMode) return;
		setViewMode('one-time');
		setSortField('paid');
		setSortDirection('asc');
	}, [debtMode]);

	const oneTimePayments = useMemo(() => payments, [payments]);
	const visibleItems = isRecurringView ? recurringTemplates : oneTimePayments;
	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredVisibleItems = useMemo(() => {
		if (!normalizedQuery) return visibleItems;

		return visibleItems.filter((item) => {
			const childName = (item.child_name || item.child_names_text || '').toLowerCase();
			const amountRaw = Number(item.amount || 0);
			const amountFixedDot = amountRaw.toFixed(2);
			const amountFixedComma = amountFixedDot.replace('.', ',');
			const amountShortDot = String(amountRaw);
			const amountShortComma = amountShortDot.replace('.', ',');
			const dateValues = isRecurringView
				? getDateSearchValues(item.next_payment_date)
				: [
					...getDateSearchValues(item.payment_date),
					...getDateSearchValues(item.created_at),
				];
			const dateMatch = dateValues.some((dateValue) => dateValue.includes(normalizedQuery));

			return (
				childName.includes(normalizedQuery) ||
				dateMatch ||
				amountFixedDot.includes(normalizedQuery) ||
				amountFixedComma.includes(normalizedQuery) ||
				amountShortDot.includes(normalizedQuery) ||
				amountShortComma.includes(normalizedQuery)
			);
		});
	}, [isRecurringView, visibleItems, normalizedQuery]);

	const sortedVisibleItems = useMemo(() => {
		const getTime = (value) => {
			if (!value) return null;
			const time = new Date(value).getTime();
			return Number.isNaN(time) ? null : time;
		};

		if (isRecurringView) {
			const frequencyOrder = {
				weekly: 1,
				monthly: 2,
				yearly: 3,
			};

			return [...filteredVisibleItems].sort((a, b) => {
				if (recurringSortField === 'amount') {
					const byAmount = Number(a.amount || 0) - Number(b.amount || 0);
					return recurringSortDirection === 'asc' ? byAmount : -byAmount;
				}

				if (recurringSortField === 'frequency') {
					const orderA = frequencyOrder[a.frequency] ?? Number.MAX_SAFE_INTEGER;
					const orderB = frequencyOrder[b.frequency] ?? Number.MAX_SAFE_INTEGER;
					const byFrequency = orderA - orderB;
					return recurringSortDirection === 'asc' ? byFrequency : -byFrequency;
				}

				if (recurringSortField === 'next_payment_date') {
					const nextA = getTime(a.next_payment_date) ?? Number.MAX_SAFE_INTEGER;
					const nextB = getTime(b.next_payment_date) ?? Number.MAX_SAFE_INTEGER;
					const byNextDate = nextA - nextB;
					return recurringSortDirection === 'asc' ? byNextDate : -byNextDate;
				}

				if (recurringSortField === 'status') {
					const statusA = a.is_active ? 1 : 0;
					const statusB = b.is_active ? 1 : 0;
					const byStatus = statusA - statusB;
					return recurringSortDirection === 'asc' ? byStatus : -byStatus;
				}

				return 0;
			});
		}

		const sorted = [...filteredVisibleItems].sort((a, b) => {
			if (sortField === 'child') {
				const childA = (a.child_name || '').toLowerCase();
				const childB = (b.child_name || '').toLowerCase();
				const byChild = childA.localeCompare(childB, 'pl', { sensitivity: 'base' });
				return sortDirection === 'asc' ? byChild : -byChild;
			}

			if (sortField === 'amount') {
				const amountA = Number(a.amount || 0);
				const amountB = Number(b.amount || 0);
				const byAmount = amountA - amountB;
				return sortDirection === 'asc' ? byAmount : -byAmount;
			}

			if (sortField === 'added') {
				const addedA = getTime(a.created_at) ?? 0;
				const addedB = getTime(b.created_at) ?? 0;
				const byAdded = addedA - addedB;
				return sortDirection === 'asc' ? byAdded : -byAdded;
			}

			if (sortField === 'paid') {
				const paidA = getTime(a.payment_date);
				const paidB = getTime(b.payment_date);

				if (paidA === null && paidB === null) return 0;
				if (paidA === null) return debtMode ? -1 : 1;
				if (paidB === null) return debtMode ? 1 : -1;

				const byPaid = paidA - paidB;
				return sortDirection === 'asc' ? byPaid : -byPaid;
			}

			return 0;
		});

		return sorted;
	}, [
		debtMode,
		filteredVisibleItems,
		isRecurringView,
		recurringSortDirection,
		recurringSortField,
		sortDirection,
		sortField,
	]);

	const handleSortChange = (field) => {
		if (sortField === field) {
			setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
			return;
		}

		setSortField(field);
		setSortDirection(field === 'child' ? 'asc' : 'desc');
	};

	const getSortArrow = (field) => {
		if (sortField !== field) return '↓';
		return sortDirection === 'asc' ? '↑' : '↓';
	};

	const handleRecurringSortChange = (field) => {
		if (recurringSortField === field) {
			setRecurringSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
			return;
		}

		setRecurringSortField(field);

		if (field === 'frequency' || field === 'next_payment_date') {
			setRecurringSortDirection('asc');
			return;
		}

		if (field === 'status') {
			setRecurringSortDirection('desc');
			return;
		}

		setRecurringSortDirection('desc');
	};

	const getRecurringSortArrow = (field) => {
		if (recurringSortField !== field) return '↓';
		return recurringSortDirection === 'asc' ? '↑' : '↓';
	};
	const visibleTitle = isRecurringView ? 'Płatności cykliczne' : 'Płatności jednorazowe';
	const visibleIcon = isRecurringView ? <FaSyncAlt /> : <FaFileInvoiceDollar />;
	const addButtonLabel = isRecurringView ? 'Dodaj wzór' : 'Dodaj płatność';

	const resolveChildName = (childId) => {
		const child = children.find((item) => item.id === Number(childId));
		if (!child) return '-';
		return `${child.first_name} ${child.last_name}`.trim();
	};

	const getAllChildrenIds = () => children.map((child) => child.id);

	const handleToggleView = () => {
		if (debtMode) return;
		setViewMode((prev) => (prev === 'one-time' ? 'recurring' : 'one-time'));
		setFormError('');
		setActionError('');
	};

	const openCreateModal = () => {
		setFormError('');
		setActionError('');
		if (isRecurringView) {
			setEditingRecurring(null);
			setRecurringForm(initialRecurringForm);
		} else {
			setEditingOneTime(null);
			setOneTimeForm(initialOneTimeForm);
		}
		setIsModalOpen(true);
	};

	const openEditModal = (item) => {
		setFormError('');
		setActionError('');
		if (isRecurringView) {
			setEditingRecurring(item);
			setRecurringForm({
				children: Array.isArray(item.children) ? item.children : [],
				amount: item.amount,
				description: item.description || '',
				frequency: item.frequency || 'monthly',
				next_payment_date: item.next_payment_date || getTodayIsoDate(),
				is_active: Boolean(item.is_active),
			});
		} else {
			setEditingOneTime(item);
			setOneTimeForm({
				child: item.child,
				amount: item.amount,
				description: item.description || '',
				payment_title: item.payment_title || '',
				payment_date: toDateInputValue(item.payment_date) || getTodayIsoDate(),
			});
		}
		setIsModalOpen(true);
	};

	const handleSave = async (event) => {
		event.preventDefault();
		setFormError('');
		setSubmitting(true);

		try {
			if (isRecurringView) {
				if (!recurringForm.children.length || !recurringForm.amount || !recurringForm.description.trim() || !recurringForm.next_payment_date) {
					setFormError('Uzupełnij wszystkie wymagane pola formularza.');
					setSubmitting(false);
					return;
				}

				const payload = {
					children: recurringForm.children.map((childId) => Number(childId)),
					amount: recurringForm.amount,
					description: recurringForm.description.trim(),
					frequency: recurringForm.frequency,
					next_payment_date: recurringForm.next_payment_date,
					is_active: recurringForm.is_active,
				};

				if (editingRecurring) {
					await axios.patch(`http://127.0.0.1:8000/api/recurring-payments/${editingRecurring.id}/`, payload, getAuthHeaders());
				} else {
					await axios.post('http://127.0.0.1:8000/api/recurring-payments/', payload, getAuthHeaders());
				}
			} else {
				if (!oneTimeForm.child || !oneTimeForm.amount || !oneTimeForm.description.trim()) {
					setFormError('Uzupełnij wszystkie wymagane pola formularza.');
					setSubmitting(false);
					return;
				}

				const payload = {
					child: Number(oneTimeForm.child),
					amount: oneTimeForm.amount,
					description: oneTimeForm.description.trim(),
					is_paid: Boolean(oneTimeForm.payment_date),
					payment_date: oneTimeForm.payment_date ? `${oneTimeForm.payment_date}T00:00:00` : null,
				};

				const manualTitle = (oneTimeForm.payment_title || '').trim();
				if (manualTitle) {
					payload.payment_title = manualTitle;
				}

				if (editingOneTime) {
					await axios.patch(`http://127.0.0.1:8000/api/payments/${editingOneTime.id}/`, payload, getAuthHeaders());
				} else {
					await axios.post('http://127.0.0.1:8000/api/payments/', payload, getAuthHeaders());
				}
			}

			setIsModalOpen(false);
			await fetchData();
		} catch (err) {
			setFormError(parseApiError(err, 'Nie udało się zapisać zmian.'));
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setActionError('');
		setSubmitting(true);
		try {
			if (deleteTarget.type === 'recurring') {
				await axios.delete(`http://127.0.0.1:8000/api/recurring-payments/${deleteTarget.id}/`, getAuthHeaders());
			} else {
				await axios.delete(`http://127.0.0.1:8000/api/payments/${deleteTarget.id}/`, getAuthHeaders());
			}
			setDeleteTarget(null);
			await fetchData();
		} catch (err) {
			setActionError(parseApiError(err, 'Nie udało się usunąć pozycji.'));
		} finally {
			setSubmitting(false);
		}
	};

	if (loading && payments.length === 0 && recurringTemplates.length === 0) {
		return <LoadingScreen message="Wczytywanie płatności..." />;
	}

	if (submitting) {
		return <LoadingScreen message="Przetwarzanie..." />;
	}

	return (
		<div className="director-container">
			<div className="page-header-row">
				<h2 className="page-title" style={{ marginBottom: 0 }}>
					<FaMoneyBillWave /> Płatności
				</h2>
			</div>

			<div className="filter-bar">
				<div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
					<FaSearch className="search-icon" />
					<input
						type="text"
						placeholder={isRecurringView ? 'Szukaj po dziecku, dacie lub kwocie...' : 'Szukaj po dziecku, dacie lub kwocie...'}
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
					/>
				</div>
				<button className="honey-btn" onClick={openCreateModal}>
					<FaPlus /> {addButtonLabel}
				</button>
			</div>

			<div className="table-card">
				<div style={{ padding: '20px 20px 10px 20px' }}>
					<button
						type="button"
						className="payments-title-toggle"
						onClick={handleToggleView}
						title={debtMode ? 'Tryb zaległości: płatności jednorazowe' : (isRecurringView ? 'Pokaż płatności jednorazowe' : 'Pokaż płatności cykliczne')}
						aria-label={debtMode ? 'Tryb zaległości: płatności jednorazowe' : (isRecurringView ? 'Pokaż płatności jednorazowe' : 'Pokaż płatności cykliczne')}
						disabled={debtMode}
					>
						<h3 className="settings-main-title" style={{ marginBottom: '12px' }}>
							<span key={viewMode} className="payments-toggle-icon">
								{visibleIcon}
							</span>
							{visibleTitle}
						</h3>
					</button>
					<p className="sub-text" style={{ marginTop: 0 }}>
						{debtMode
							? 'Tryb zaległości: najpierw nieopłacone (bez daty opłacenia), opłacone na końcu.'
							: 'Kliknij ikonę przy tytule, aby przełączyć widok.'}
					</p>
				</div>
				<div key={viewMode} className="payments-view-animated">
					{isRecurringView ? (
						<RecurringTemplatesTable
							items={sortedVisibleItems}
							onEdit={openEditModal}
							recurringSortField={recurringSortField}
							getRecurringSortArrow={getRecurringSortArrow}
							onRecurringSortChange={handleRecurringSortChange}
							onDelete={(template) => {
								setDeleteTarget({
									type: 'recurring',
									id: template.id,
									name: `${template.description || 'Wzór płatności'} (${template.child_names_text || '-'})`,
								});
							}}
						/>
					) : (
						<PaymentsTable
							items={sortedVisibleItems}
							onEdit={openEditModal}
							onDelete={(payment) => {
								setDeleteTarget({
									type: 'one-time',
									id: payment.id,
									name: `${payment.description || 'Płatność'} (${resolveChildName(payment.child)})`,
								});
							}}
							sortField={sortField}
							getSortArrow={getSortArrow}
							onSortChange={handleSortChange}
						/>
					)}
				</div>
			</div>

			{isModalOpen && (
				<div className="modal-overlay">
					<div className="modal-content large">
						<h3>
							{isRecurringView
								? editingRecurring
									? 'Edytuj wzór cykliczny'
									: 'Dodaj wzór cykliczny'
								: editingOneTime
									? 'Edytuj płatność jednorazową'
									: 'Dodaj płatność jednorazową'}
						</h3>
						{formError && <div className="form-error">{formError}</div>}

						<form onSubmit={handleSave} className="modal-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
							<div className="form-group">
								<label>{isRecurringView ? 'Dzieci' : 'Dziecko'} <span className="required-asterisk">*</span></label>
								<select
									multiple={isRecurringView}
									value={isRecurringView ? recurringForm.children.map(String) : oneTimeForm.child}
									onChange={(event) => {
										if (isRecurringView) {
											const selectedValues = Array.from(event.target.selectedOptions, (option) => option.value);
											if (selectedValues.includes(ALL_CHILDREN_OPTION_VALUE)) {
												setRecurringForm((prev) => ({ ...prev, children: getAllChildrenIds() }));
												return;
											}

											const selectedChildren = selectedValues.map((value) => Number(value));
											setRecurringForm((prev) => ({ ...prev, children: selectedChildren }));
										} else {
											const value = event.target.value ? Number(event.target.value) : '';
											setOneTimeForm((prev) => ({ ...prev, child: value }));
										}
									}}
								>
									{!isRecurringView && <option value="">-- Wybierz dziecko --</option>}
									{isRecurringView && <option value={ALL_CHILDREN_OPTION_VALUE}>-- Wszystkie --</option>}
									{children.map((child) => (
										<option key={child.id} value={child.id}>
											{child.first_name} {child.last_name}
										</option>
									))}
								</select>
								{isRecurringView && (
									<div className="sub-text" style={{ marginTop: '6px' }}>
										Przytrzymaj Ctrl, aby zaznaczyć wiele dzieci.
									</div>
								)}
							</div>

							<div className="form-group">
								<label>Kwota <span className="required-asterisk">*</span></label>
								<input
									type="number"
									step="0.01"
									min="0"
									value={isRecurringView ? recurringForm.amount : oneTimeForm.amount}
									onChange={(event) => {
										const value = event.target.value;
										if (isRecurringView) {
											setRecurringForm((prev) => ({ ...prev, amount: value }));
										} else {
											setOneTimeForm((prev) => ({ ...prev, amount: value }));
										}
									}}
								/>
							</div>

							<div className="form-group full-width">
								<label>Opis <span className="required-asterisk">*</span></label>
								<input
									type="text"
									value={isRecurringView ? recurringForm.description : oneTimeForm.description}
									onChange={(event) => {
										const value = event.target.value;
										if (isRecurringView) {
											setRecurringForm((prev) => ({ ...prev, description: value }));
										} else {
											setOneTimeForm((prev) => ({ ...prev, description: value }));
										}
									}}
								/>
							</div>

							{!isRecurringView && (
								<div className="form-group full-width">
									<label>Tytuł płatności</label>
									<input
										type="text"
										value={oneTimeForm.payment_title}
										onChange={(event) => setOneTimeForm((prev) => ({ ...prev, payment_title: event.target.value }))}
										placeholder="Np. JAN/KOWALSKI/032026/001"
									/>
									<div className="sub-text" style={{ marginTop: '6px' }}>
										Jeśli pole pozostanie puste, tytuł zostanie wygenerowany automatycznie.
									</div>
								</div>
							)}

							{!isRecurringView && (
								<div className="form-group full-width">
									<label>Data opłacenia</label>
									<input
										type="date"
										value={oneTimeForm.payment_date}
										onChange={(event) => setOneTimeForm((prev) => ({ ...prev, payment_date: event.target.value }))}
									/>
									<div className="sub-text" style={{ marginTop: '6px' }}>
										Jeśli pole jest puste, płatność jest traktowana jako nieopłacona.
									</div>
								</div>
							)}

							{isRecurringView && (
								<>
									<div className="form-group">
										<label>Częstotliwość <span className="required-asterisk">*</span></label>
										<select
											value={recurringForm.frequency}
											onChange={(event) => setRecurringForm((prev) => ({ ...prev, frequency: event.target.value }))}
										>
											<option value="weekly">Co tydzień</option>
											<option value="monthly">Co miesiąc</option>
											<option value="yearly">Co rok</option>
										</select>
									</div>

									<div className="form-group">
										<label>Data następnej płatności <span className="required-asterisk">*</span></label>
										<input
											type="date"
											value={recurringForm.next_payment_date}
											onChange={(event) => setRecurringForm((prev) => ({ ...prev, next_payment_date: event.target.value }))}
										/>
									</div>

									<div className="form-group full-width">
										<label>
											<input
												type="checkbox"
												checked={recurringForm.is_active}
												onChange={(event) => setRecurringForm((prev) => ({ ...prev, is_active: event.target.checked }))}
												style={{ width: 'auto', marginRight: '8px' }}
											/>
											Wzór aktywny
										</label>
									</div>
								</>
							)}

							<div className="modal-actions full-width">
								<button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
								<button type="submit" className="modal-btn confirm success"><FaSave /> Zapisz</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteTarget && (
				<div className="modal-overlay">
					<div className="delete-modal-content">
						<div className="warning-icon"><FaExclamationTriangle /></div>
						<h3>Usunąć pozycję?</h3>
						<p>
							Czy na pewno chcesz usunąć:
							{` "${deleteTarget.name}"`}
							? Tej operacji nie można cofnąć.
						</p>
						{actionError && <div className="form-error">{actionError}</div>}
						<div className="modal-actions">
							<button className="modal-btn cancel" onClick={() => { setActionError(''); setDeleteTarget(null); }}>
								Anuluj
							</button>
							<button className="modal-btn confirm danger" onClick={handleDelete}>
								<FaTrashAlt /> Usuń
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default DirectorPayments;
