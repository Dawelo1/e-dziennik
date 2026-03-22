// frontend/src/director/DirectorMenu.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Wspólne style
import LoadingScreen from '../users/LoadingScreen';
import { formatDateWithDots } from '../dateUtils';

import { 
  FaUtensils, FaSearch, FaPlus, FaEdit, FaTrash, FaSave, FaExclamationTriangle, FaTrashAlt, FaPrint
} from 'react-icons/fa';

const DirectorMenu = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtr
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const initialForm = {
    date: '',
    breakfast_soup: '', breakfast_main_course: '', breakfast_beverage: '', breakfast_fruit: '',
    lunch_soup: '', lunch_main_course: '', lunch_beverage: '', lunch_fruit: '',
    fruit_break: '', allergens: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pastDateConfirmOpen, setPastDateConfirmOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState({ date: false });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({ date: false });
  const invalidFieldTimers = useRef({ date: null });
  const todayDate = new Date().toISOString().split('T')[0];
  const isPastDateForNewMenu = !editingMenu && formData.date && formData.date < todayDate;

  const fetchData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/menu/', getAuthHeaders());
      setMenus(res.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const normalizeDateSearch = (value = '') =>
    String(value)
      // Ujednolicamy zapis 05.01 -> 5.1, aby oba formaty wyszukiwania działały tak samo.
      .replace(/(^|[^\d])0(?=\d)/g, '$1')
      .toLowerCase();

  const filteredMenus = menus.filter((menu) => {
    const query = searchQuery.toLowerCase().trim();
    const normalizedQuery = normalizeDateSearch(query);
    if (!query) return true;

    const menuDate = new Date(`${menu.date}T00:00:00`);
    const menuDateLocale = menuDate.toLocaleDateString('pl-PL').toLowerCase();
    const menuDateLocalePadded = menuDate.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).toLowerCase();
    const menuDateWithWeekday = menuDate.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).toLowerCase();
    const menuDateIso = String(menu.date || '').toLowerCase();
    const normalizedDateFields = [
      menuDateLocale,
      menuDateLocalePadded,
      menuDateWithWeekday,
      menuDateIso
    ].map((value) => normalizeDateSearch(value));

    return (
      menuDateLocale.includes(query) ||
      menuDateLocalePadded.includes(query) ||
      menuDateWithWeekday.includes(query) ||
      menuDateIso.includes(query) ||
      normalizedDateFields.some((value) => value.includes(normalizedQuery))
    );
  });
  const sortedFilteredMenus = [...filteredMenus].sort(
    (a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)
  );

  const getWeekMeta = (dateString) => {
    const date = new Date(`${dateString}T00:00:00`);
    const dayFromMonday = (date.getDay() + 6) % 7;

    const monday = new Date(date);
    monday.setDate(date.getDate() - dayFromMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const toIso = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const mondayIso = toIso(monday);
    const fridayIso = toIso(friday);

    return {
      key: mondayIso,
      label: `Tydzień: ${formatDateWithDots(mondayIso)} - ${formatDateWithDots(fridayIso)}`
    };
  };

  const menusByWeeks = sortedFilteredMenus.reduce((acc, menu) => {
    const weekMeta = getWeekMeta(menu.date);
    const existingWeek = acc.find((week) => week.key === weekMeta.key);

    if (existingWeek) {
      existingWeek.items.push(menu);
      return acc;
    }

    acc.push({
      key: weekMeta.key,
      label: weekMeta.label,
      items: [menu]
    });

    return acc;
  }, []);

  const openModal = (menu = null) => {
    setError('');
    setActionError('');
    setInvalidFields({ date: false });
    setRequiredFieldErrors({ date: false });
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        date: menu.date,
        breakfast_soup: menu.breakfast_soup || '',
        breakfast_main_course: menu.breakfast_main_course || '',
        breakfast_beverage: menu.breakfast_beverage || '',
        breakfast_fruit: menu.breakfast_fruit || '',
        lunch_soup: menu.lunch_soup || '',
        lunch_main_course: menu.lunch_main_course || '',
        lunch_beverage: menu.lunch_beverage || '',
        lunch_fruit: menu.lunch_fruit || '',
        fruit_break: menu.fruit_break || '',
        allergens: menu.allergens || ''
      });
    } else {
      setEditingMenu(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const triggerInvalidField = (fieldName) => {
    setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));

    requestAnimationFrame(() => {
      setInvalidFields((prev) => ({ ...prev, [fieldName]: true }));
    });

    if (invalidFieldTimers.current[fieldName]) {
      clearTimeout(invalidFieldTimers.current[fieldName]);
    }

    invalidFieldTimers.current[fieldName] = setTimeout(() => {
      setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));
    }, 650);
  };

  const clearInvalidField = (fieldName) => {
    if (invalidFieldTimers.current[fieldName]) {
      clearTimeout(invalidFieldTimers.current[fieldName]);
      invalidFieldTimers.current[fieldName] = null;
    }
    setInvalidFields((prev) => ({ ...prev, [fieldName]: false }));
  };

  useEffect(() => {
    return () => {
      Object.values(invalidFieldTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const saveMenu = async () => {
    setLoading(true);
    try {
      if (editingMenu) {
        await axios.patch(`http://127.0.0.1:8000/api/menu/${editingMenu.id}/`, formData, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/menu/', formData, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError("Błąd zapisu. Sprawdź, czy na ten dzień nie ma już jadłospisu.");
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const missingDate = !formData.date;

    setRequiredFieldErrors({
      date: missingDate
    });

    if (missingDate) {
      triggerInvalidField('date');
      return;
    }

    const trimmedAllergens = (formData.allergens || '').trim();
    const allergensPattern = /^\d+(\s*,\s*\d+)*$/;

    if (trimmedAllergens && !allergensPattern.test(trimmedAllergens)) {
      setError('Pole „Alergeny” może zawierać tylko liczby (np. 1, 3, 7).');
      return;
    }

    if (isPastDateForNewMenu) {
      setPastDateConfirmOpen(true);
      return;
    }

    await saveMenu();
  };

  const handlePastDateConfirm = async () => {
    setPastDateConfirmOpen(false);
    await saveMenu();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/menu/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć jadłospisu. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const mealPart = (label, value) => (
    <div><strong>{label}:</strong> {value || '-'}</div>
  );

  const mealPartText = (label, value) => `${label}: ${value || '-'}`;

  const handlePrintWeek = (week) => {
    setActionError('');
    const printWindow = window.open('', '_blank', 'width=960,height=720');

    if (!printWindow) {
      setActionError('Nie udało się otworzyć okna wydruku. Sprawdź blokadę wyskakujących okien.');
      return;
    }

    const printableItems = [...week.items].sort(
      (a, b) => new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`)
    );

    const rowsHtml = printableItems.map((menu) => {
      const dateLabel = new Date(`${menu.date}T00:00:00`).toLocaleDateString('pl-PL', {
        weekday: 'long'
      });

      const breakfastText = [
        mealPartText('Zupa', menu.breakfast_soup),
        mealPartText('Drugie danie', menu.breakfast_main_course),
        mealPartText('Napój', menu.breakfast_beverage),
        mealPartText('Owoc / Dodatek', menu.breakfast_fruit)
      ].join('\n');

      const lunchText = [
        mealPartText('Zupa', menu.lunch_soup),
        mealPartText('Drugie danie', menu.lunch_main_course),
        mealPartText('Napój', menu.lunch_beverage),
        mealPartText('Owoc / Deser', menu.lunch_fruit)
      ].join('\n');

      return `
        <tr>
          <td>${escapeHtml(dateLabel)}</td>
          <td>${escapeHtml(breakfastText).replaceAll('\n', '<br/>')}</td>
          <td>${escapeHtml(lunchText).replaceAll('\n', '<br/>')}</td>
          <td>${escapeHtml(menu.fruit_break || '-')}</td>
          <td>${escapeHtml(menu.allergens || '-')}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html lang="pl">
        <head>
          <meta charset="UTF-8" />
          <title>Plan tygodniowy jadłospisu</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
            h1 { margin: 0 0 6px 0; font-size: 22px; }
            h2 { margin: 0 0 20px 0; font-size: 16px; color: #555; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
            th { background: #f3edff; color: #5d4b8a; text-transform: uppercase; font-size: 12px; }
            tr:nth-child(even) td { background: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Jadłospis tygodniowy</h1>
          <h2>${escapeHtml(week.label)}</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Śniadanie</th>
                <th>Obiad</th>
                <th>Podwieczorek</th>
                <th>Alergeny</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loading && menus.length === 0) return <LoadingScreen message="Wczytywanie jadłospisów..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaUtensils /> Zarządzanie Jadłospisem
        </h2>
      </div>

      {actionError && <div className="form-error">{actionError}</div>}

      {/* FILTRY */}
      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input 
            type="text"
            placeholder="Szukaj po dacie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-date-btn" onClick={() => setSearchQuery('')}>
              &times;
            </button>
          )}
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Jadłospis na Dzień
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Śniadanie</th>
              <th>Obiad</th>
              <th>Podwieczorek</th>
              <th>Alergeny</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {menusByWeeks.map((week) => (
              <React.Fragment key={week.key}>
                <tr className="menu-week-row">
                  <td colSpan={6} className="menu-week-cell">
                    <div className="menu-week-header">
                      <span>{week.label}</span>
                      <button
                        type="button"
                        className="menu-week-print-btn"
                        onClick={() => handlePrintWeek(week)}
                      >
                        <FaPrint /> Drukuj tydzień
                      </button>
                    </div>
                  </td>
                </tr>
                {week.items.map(menu => (
                  <tr key={menu.id}>
                    <td style={{fontWeight: 700}}>{new Date(menu.date).toLocaleDateString('pl-PL', {weekday:'long', day:'numeric', month:'long'})}</td>
                    <td>
                      {mealPart('Zupa', menu.breakfast_soup)}
                      {mealPart('Drugie danie', menu.breakfast_main_course)}
                      {mealPart('Napój', menu.breakfast_beverage)}
                      {mealPart('Owoc / Dodatek', menu.breakfast_fruit)}
                    </td>
                    <td>
                      {mealPart('Zupa', menu.lunch_soup)}
                      {mealPart('Drugie danie', menu.lunch_main_course)}
                      {mealPart('Napój', menu.lunch_beverage)}
                      {mealPart('Owoc / Deser', menu.lunch_fruit)}
                    </td>
                    <td>{menu.fruit_break || '-'}</td>
                    <td>{menu.allergens || '-'}</td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" onClick={() => openModal(menu)} title="Edytuj jadłospis"><FaEdit/></button>
                      <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(menu); }} title="Usuń jadłospis"><FaTrash/></button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{maxWidth: '800px'}}>
            <h3>{editingMenu ? `Edytuj Jadłospis na ${formatDateWithDots(formData.date)}` : 'Nowy Jadłospis'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} noValidate>
              <div className="form-group" style={{marginBottom: 20}}>
                <label>Data <span className="required-asterisk">*</span></label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => {
                    setFormData({...formData, date: e.target.value});
                    if (e.target.value) {
                      clearInvalidField('date');
                      setRequiredFieldErrors((prev) => ({ ...prev, date: false }));
                    }
                  }}
                  disabled={!!editingMenu}
                  className={invalidFields.date ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.date && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
                {isPastDateForNewMenu && (
                  <div className="field-required-message">Uwaga: wybrana data jest wcześniejsza niż dzisiaj.</div>
                )}
              </div>

              <div className="modal-form-grid">
                {/* Śniadanie */}
                <fieldset className="form-fieldset">
                  <legend>Śniadanie</legend>
                  <div className="form-group"><input type="text" placeholder="Zupa mleczna" value={formData.breakfast_soup} onChange={e => setFormData({...formData, breakfast_soup: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Drugie danie / Kanapki" value={formData.breakfast_main_course} onChange={e => setFormData({...formData, breakfast_main_course: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Napój" value={formData.breakfast_beverage} onChange={e => setFormData({...formData, breakfast_beverage: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Owoc / Dodatek" value={formData.breakfast_fruit} onChange={e => setFormData({...formData, breakfast_fruit: e.target.value})} /></div>
                </fieldset>
                
                {/* Obiad */}
                <fieldset className="form-fieldset">
                  <legend>Obiad</legend>
                  <div className="form-group"><input type="text" placeholder="Zupa" value={formData.lunch_soup} onChange={e => setFormData({...formData, lunch_soup: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Drugie danie" value={formData.lunch_main_course} onChange={e => setFormData({...formData, lunch_main_course: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Napój" value={formData.lunch_beverage} onChange={e => setFormData({...formData, lunch_beverage: e.target.value})} /></div>
                  <div className="form-group"><input type="text" placeholder="Deser / Owoc" value={formData.lunch_fruit} onChange={e => setFormData({...formData, lunch_fruit: e.target.value})} /></div>
                </fieldset>
              </div>
              
              <div className="modal-form-grid" style={{marginTop: 20}}>
                <div className="form-group"><label>Podwieczorek</label><input type="text" value={formData.fruit_break} onChange={e => setFormData({...formData, fruit_break: e.target.value})} /></div>
                <div className="form-group"><label>Alergeny</label><input type="text" placeholder="np. 1, 3, 7" value={formData.allergens} onChange={e => {
                  const sanitized = e.target.value.replace(/[^\d,\s]/g, '');
                  setFormData({...formData, allergens: sanitized});
                  if (error.includes('Alergeny')) setError('');
                }} /></div>
              </div>
              
              <div className="modal-actions full-width" style={{marginTop: 30}}>
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
            <h3>Usunąć jadłospis?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć jadłospis z dnia
              {` "${formatDateWithDots(deleteTarget.date)}"`}
              ? Tej operacji nie można cofnąć.
            </p>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => { setActionError(''); setDeleteTarget(null); }}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={handleDelete}><FaTrashAlt /> Usuń</button>
            </div>
          </div>
        </div>
      )}

      {pastDateConfirmOpen && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Dodać jadłospis z wcześniejszą datą?</h3>
            <p>
              Wybrana data ({formatDateWithDots(formData.date)}) jest wcześniejsza niż dzisiaj.
              Czy na pewno chcesz zapisać jadłospis?
            </p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setPastDateConfirmOpen(false)}>Anuluj</button>
              <button className="modal-btn confirm danger" onClick={handlePastDateConfirm}><FaSave /> Zapisz mimo to</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorMenu;