// frontend/src/director/DirectorChildren.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css'; // Używamy wspólnych stylów dla spójności
import LoadingScreen from '../users/LoadingScreen';
import { formatDateWithDots } from '../dateUtils';

import { 
  FaChild, FaSearch, FaPlus, FaEdit, FaTrash, 
  FaUserFriends, FaSave, FaTimes, FaExclamationTriangle, FaTrashAlt
} from 'react-icons/fa';

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const DirectorChildren = () => {
  const [children, setChildren] = useState([]);
  const [groups, setGroups] = useState([]);
  const [parents, setParents] = useState([]); // Lista wszystkich rodziców do wyboru
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [sortField, setSortField] = useState('group');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState(null);

  // Formularz
  const initialForm = {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    group: '',     // ID grupy
    parents: [],   // Tablica ID rodziców
    medical_info: '',
    meal_rate: '20.00',
    uses_meals: 'false',
    meal_start_date: getTodayIsoDate()
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [parentLimitError, setParentLimitError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invalidFields, setInvalidFields] = useState({
    first_name: false,
    last_name: false,
    date_of_birth: false,
    uses_meals: false,
    meal_start_date: false,
    meal_rate: false,
    group: false,
    parents: false
  });
  const [requiredFieldErrors, setRequiredFieldErrors] = useState({
    first_name: false,
    last_name: false,
    date_of_birth: false,
    uses_meals: false,
    meal_start_date: false,
    meal_rate: false,
    group: false,
    parents: false
  });
  const invalidFieldTimers = useRef({
    first_name: null,
    last_name: null,
    date_of_birth: null,
    uses_meals: null,
    meal_start_date: null,
    meal_rate: null,
    group: null,
    parents: null
  });

  // 1. POBIERANIE DANYCH (Dzieci, Grupy, Rodzice)
  const fetchData = async () => {
    try {
      const [childRes, groupRes, userRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/children/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/groups/', getAuthHeaders()),
        axios.get('http://127.0.0.1:8000/api/users/manage/', getAuthHeaders()) // Pobieramy wszystkich userów
      ]);

      setChildren(childRes.data);
      setGroups(groupRes.data);
      
      // Filtrujemy userów, bierzemy tylko rodziców (is_parent=true)
      const parentUsers = userRes.data.filter(u => u.is_parent);
      setParents(parentUsers);

    } catch (err) {
      console.error("Błąd pobierania danych:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrowanie listy
  const filteredChildren = children.filter(c => 
    c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredParents = parents.filter((parent) => {
    const query = parentSearchQuery.trim().toLowerCase();
    const fullName = `${parent.first_name || ''} ${parent.last_name || ''}`.toLowerCase();
    return fullName.includes(query);
  });

  // 2. OTWIERANIE MODALA
  const openModal = (child = null) => {
    setError('');
    setActionError('');
    setParentLimitError('');
    setParentSearchQuery('');
    setInvalidFields({
      first_name: false,
      last_name: false,
      date_of_birth: false,
      uses_meals: false,
      meal_start_date: false,
      meal_rate: false,
      group: false,
      parents: false
    });
    setRequiredFieldErrors({
      first_name: false,
      last_name: false,
      date_of_birth: false,
      uses_meals: false,
      meal_start_date: false,
      meal_rate: false,
      group: false,
      parents: false
    });
    if (child) {
      setEditingChild(child);
      setFormData({
      first_name: child.first_name,
      last_name: child.last_name,
      date_of_birth: child.date_of_birth,
      group: child.group,
      parents: child.parents, 
      medical_info: child.medical_info || '',
      meal_rate: child.meal_rate || '20.00',
      uses_meals: child.uses_meals ? 'true' : 'false',
      meal_start_date: child.meal_start_date || ''
    });
    } else {
      setEditingChild(null);
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

  // Obsługa Multiselecta dla Rodziców
  const handleParentToggle = (parentId) => {
    setFormData(prev => {
      const currentParents = prev.parents || [];
      if (currentParents.includes(parentId)) {
        setParentLimitError('');
        // Usuń
        return { ...prev, parents: currentParents.filter(id => id !== parentId) };
      } else {
        // Dodaj (Max 2)
        if (currentParents.length >= 2) {
          setParentLimitError('Możesz przypisać maksymalnie 2 rodziców.');
          triggerInvalidField('parents');
          return prev;
        }
        setParentLimitError('');
        clearInvalidField('parents');
        setRequiredFieldErrors((prevErrors) => ({ ...prevErrors, parents: false }));
        return { ...prev, parents: [...currentParents, parentId] };
      }
    });
  };

  // 3. ZAPISYWANIE
  const handleSave = async (e) => {
    e.preventDefault();

    const missingFirstName = !formData.first_name.trim();
    const missingLastName = !formData.last_name.trim();
    const missingDateOfBirth = !formData.date_of_birth;
    const missingUsesMeals = formData.uses_meals === '';
    const selectedUsesMeals = formData.uses_meals === 'true';
    const missingMealStartDate = selectedUsesMeals && !formData.meal_start_date;
    const missingMealRate = selectedUsesMeals && !String(formData.meal_rate).trim();
    const missingGroup = !formData.group;
    const missingParents = !formData.parents || formData.parents.length === 0;

    setRequiredFieldErrors({
      first_name: missingFirstName,
      last_name: missingLastName,
      date_of_birth: missingDateOfBirth,
      uses_meals: missingUsesMeals,
      meal_start_date: missingMealStartDate,
      meal_rate: missingMealRate,
      group: missingGroup,
      parents: missingParents
    });

    if (missingFirstName) triggerInvalidField('first_name');
    if (missingLastName) triggerInvalidField('last_name');
    if (missingDateOfBirth) triggerInvalidField('date_of_birth');
    if (missingUsesMeals) triggerInvalidField('uses_meals');
    if (missingMealStartDate) triggerInvalidField('meal_start_date');
    if (missingMealRate) triggerInvalidField('meal_rate');
    if (missingGroup) triggerInvalidField('group');
    if (missingParents) triggerInvalidField('parents');

    if (missingFirstName || missingLastName || missingDateOfBirth || missingUsesMeals || missingMealStartDate || missingMealRate || missingGroup || missingParents) return;

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        uses_meals: selectedUsesMeals,
        meal_start_date: selectedUsesMeals ? formData.meal_start_date : null
      };

      if (editingChild) {
        await axios.patch(`http://127.0.0.1:8000/api/children/${editingChild.id}/`, payload, getAuthHeaders());
      } else {
        await axios.post('http://127.0.0.1:8000/api/children/', payload, getAuthHeaders());
      }
      setIsModalOpen(false);
      await fetchData(); // Odśwież wszystko
    } catch (err) {
      console.error(err);
      const responseData = err?.response?.data;
      if (typeof responseData === 'string' && responseData.trim()) {
        setError(responseData);
      } else if (responseData && typeof responseData === 'object') {
        const firstError = Object.values(responseData).flat()[0];
        if (firstError) {
          setError(String(firstError));
        } else {
          setError('Wystąpił błąd zapisu. Sprawdź poprawność danych.');
        }
      } else {
        setError('Wystąpił błąd zapisu. Sprawdź poprawność danych.');
      }
      setLoading(false);
    }
  };

  // 4. USUWANIE
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`http://127.0.0.1:8000/api/children/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć kartoteki dziecka. Spróbuj ponownie później.');
      setLoading(false);
    }
  };

  // Helper do wyświetlania nazwy grupy
  const stripLeadingGroupEmoji = (groupName = '') => {
    return groupName.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  };

  const getGroupName = (id) => {
    const g = groups.find(x => x.id === id);
    return g ? stripLeadingGroupEmoji(g.name) : '-';
  };

  const getGroupBadgeClass = (groupId) => {
    if (!groupId) return 'group-default';

    const group = groups.find((item) => item.id === groupId);
    if (!group?.color_key) return 'group-default';
    return `group-color-${group.color_key}`;
  };

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const getSortArrow = (field) => {
    if (sortField !== field) return '↓';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const sortedChildren = [...filteredChildren].sort((a, b) => {
    if (sortField === 'group') {
      const groupA = getGroupName(a.group);
      const groupB = getGroupName(b.group);
      const byGroup = groupA.localeCompare(groupB, 'pl', { sensitivity: 'base' });

      if (byGroup !== 0) {
        return sortDirection === 'asc' ? byGroup : -byGroup;
      }

      const byLastName = (a.last_name || '').localeCompare(b.last_name || '', 'pl', { sensitivity: 'base' });
      if (byLastName !== 0) return byLastName;
      return (a.first_name || '').localeCompare(b.first_name || '', 'pl', { sensitivity: 'base' });
    }

    if (sortField === 'uses_meals') {
      const mealsA = a.uses_meals ? 1 : 0;
      const mealsB = b.uses_meals ? 1 : 0;
      const byMeals = mealsA - mealsB;

      if (byMeals !== 0) {
        return sortDirection === 'asc' ? byMeals : -byMeals;
      }

      const byLastName = (a.last_name || '').localeCompare(b.last_name || '', 'pl', { sensitivity: 'base' });
      if (byLastName !== 0) return byLastName;
      return (a.first_name || '').localeCompare(b.first_name || '', 'pl', { sensitivity: 'base' });
    }

    if (sortField === 'meal_rate') {
      const rateA = Number(String(a.meal_rate ?? '0').replace(',', '.'));
      const rateB = Number(String(b.meal_rate ?? '0').replace(',', '.'));
      const byRate = rateA - rateB;

      if (byRate !== 0) {
        return sortDirection === 'asc' ? byRate : -byRate;
      }

      const byLastName = (a.last_name || '').localeCompare(b.last_name || '', 'pl', { sensitivity: 'base' });
      if (byLastName !== 0) return byLastName;
      return (a.first_name || '').localeCompare(b.first_name || '', 'pl', { sensitivity: 'base' });
    }

    return 0;
  });

  if (loading && children.length === 0) return <LoadingScreen message="Wczytywanie dzieci..." />;
  if (loading) return <LoadingScreen message="Przetwarzanie..." />;

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaChild /> Kartoteki Dzieci
        </h2>
      </div>

      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon"/>
          <input 
            type="text" 
            placeholder="Szukaj dziecka..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Dziecko
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Dziecko</th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('group')}
                >
                  Grupa <span className="sort-arrow">{getSortArrow('group')}</span>
                </button>
              </th>
              <th>Rodzice / Opiekunowie</th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('uses_meals')}
                >
                  Posiłki <span className="sort-arrow">{getSortArrow('uses_meals')}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sortable-header-btn"
                  onClick={() => handleSortChange('meal_rate')}
                >
                  Stawka żywieniowa <span className="sort-arrow">{getSortArrow('meal_rate')}</span>
                </button>
              </th>
              <th>Informacje medyczne</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sortedChildren.map(child => {
              const groupName = getGroupName(child.group);
              const groupBadgeClass = getGroupBadgeClass(child.group);

              return (
              <tr key={child.id}>
                <td>
                  <div className="user-cell">
                    <div className="avatar-circle parent" style={{background: '#4caf50'}}>
                      {child.first_name[0]}
                    </div>
                    <div className="contact-info">
                      <span className="username-text">{child.first_name} {child.last_name}</span>
                      <span className="sub-text">{formatDateWithDots(child.date_of_birth)}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${groupBadgeClass}`}>
                    {groupName}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap: 5, flexWrap:'wrap'}}>
                    {child.parents && child.parents.map(parentId => {
                       const p = parents.find(u => u.id === parentId);
                       return p ? (
                         <span key={p.id} className="role-badge parent" style={{fontSize: 11}}>
                           {p.first_name} {p.last_name}
                         </span>
                       ) : null;
                    })}
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${child.uses_meals ? 'meal-yes' : 'meal-no'}`}>
                    {child.uses_meals ? 'Tak' : 'Nie'}
                  </span>
                </td>
                <td>
                  {child.uses_meals
                    ? `${String(child.meal_rate ?? '0.00').replace('.', ',')} zł`
                    : '-'}
                </td>
                <td>
                  <div style={{fontSize: 12, color: '#666', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {child.medical_info?.trim() ? child.medical_info : '-'}
                  </div>
                </td>
                <td className="actions-cell">
                  <button className="action-icon-btn edit" onClick={() => openModal(child)} title="Edytuj dziecko"><FaEdit/></button>
                  <button className="action-icon-btn delete" onClick={() => { setActionError(''); setDeleteTarget(child); }} title="Usuń dziecko"><FaTrash/></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h3>{editingChild ? 'Edytuj Dziecko' : 'Dodaj Dziecko'}</h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid" noValidate>
              
              <div className="form-group">
                <label>Imię <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={e => {
                    setFormData({...formData, first_name: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('first_name');
                      setRequiredFieldErrors((prev) => ({ ...prev, first_name: false }));
                    }
                  }}
                  className={invalidFields.first_name ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.first_name && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>
              <div className="form-group">
                <label>Nazwisko <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={e => {
                    setFormData({...formData, last_name: e.target.value});
                    if (e.target.value.trim()) {
                      clearInvalidField('last_name');
                      setRequiredFieldErrors((prev) => ({ ...prev, last_name: false }));
                    }
                  }}
                  className={invalidFields.last_name ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.last_name && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group">
                <label>Data urodzenia <span className="required-asterisk">*</span></label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={e => {
                    setFormData({...formData, date_of_birth: e.target.value});
                    if (e.target.value) {
                      clearInvalidField('date_of_birth');
                      setRequiredFieldErrors((prev) => ({ ...prev, date_of_birth: false }));
                    }
                  }}
                  className={invalidFields.date_of_birth ? 'invalid-bounce' : ''}
                />
                {requiredFieldErrors.date_of_birth && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group">
                <label>Grupa <span className="required-asterisk">*</span></label>
                <select
                  value={formData.group}
                  onChange={e => {
                    const nextGroupValue = e.target.value ? parseInt(e.target.value, 10) : '';
                    setFormData({...formData, group: nextGroupValue});
                    if (nextGroupValue) {
                      clearInvalidField('group');
                      setRequiredFieldErrors((prev) => ({ ...prev, group: false }));
                    }
                  }}
                  className={invalidFields.group ? 'invalid-bounce' : ''}
                >
                  <option value="">-- Wybierz grupę --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{stripLeadingGroupEmoji(g.name)}</option>
                  ))}
                </select>
                {requiredFieldErrors.group && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className="form-group">
                <label>Posiłki <span className="required-asterisk">*</span></label>
                <select
                  value={formData.uses_meals}
                  onChange={e => {
                    const nextUsesMeals = e.target.value;
                    const nextMealRate = nextUsesMeals === 'true' ? '20.00' : '0.00';
                    const nextMealStartDate = nextUsesMeals === 'true' ? (formData.meal_start_date || getTodayIsoDate()) : '';
                    setFormData({...formData, uses_meals: nextUsesMeals, meal_rate: nextMealRate, meal_start_date: nextMealStartDate});
                    if (nextUsesMeals !== '') {
                      clearInvalidField('uses_meals');
                      setRequiredFieldErrors((prev) => ({ ...prev, uses_meals: false }));
                    }
                    if (nextUsesMeals === 'false') {
                      clearInvalidField('meal_start_date');
                      setRequiredFieldErrors((prev) => ({ ...prev, meal_start_date: false }));
                      clearInvalidField('meal_rate');
                      setRequiredFieldErrors((prev) => ({ ...prev, meal_rate: false }));
                    }
                  }}
                  className={invalidFields.uses_meals ? 'invalid-bounce' : ''}
                >
                  <option value="true">Tak</option>
                  <option value="false">Nie</option>
                </select>
                {requiredFieldErrors.uses_meals && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
              </div>

              <div className={`form-group ${formData.uses_meals !== 'true' ? 'meal-rate-disabled' : ''}`}>
                <label>
                  Data rozpoczęcia posiłków
                  {formData.uses_meals === 'true' && <span className="required-asterisk">*</span>}
                </label>
                <input
                  type="date"
                  value={formData.meal_start_date}
                  disabled={formData.uses_meals !== 'true'}
                  onChange={e => {
                    setFormData({...formData, meal_start_date: e.target.value});
                    if (e.target.value) {
                      clearInvalidField('meal_start_date');
                      setRequiredFieldErrors((prev) => ({ ...prev, meal_start_date: false }));
                    }
                  }}
                  className={invalidFields.meal_start_date ? 'invalid-bounce' : ''}
                />
                {formData.uses_meals === 'true' && requiredFieldErrors.meal_start_date && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
                {formData.uses_meals !== 'true' && (
                  <div className="field-disabled-message">Pole nieaktywne, gdy dziecko nie korzysta z posiłków.</div>
                )}
              </div>

              <div className={`form-group ${formData.uses_meals !== 'true' ? 'meal-rate-disabled' : ''}`}>
                <label>
                  Stawka żywieniowa (zł)
                  {formData.uses_meals === 'true' && <span className="required-asterisk">*</span>}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={formData.meal_rate} 
                  disabled={formData.uses_meals !== 'true'}
                  onChange={e => {
                    setFormData({...formData, meal_rate: e.target.value});
                    if (String(e.target.value).trim()) {
                      clearInvalidField('meal_rate');
                      setRequiredFieldErrors((prev) => ({ ...prev, meal_rate: false }));
                    }
                  }}
                  className={invalidFields.meal_rate ? 'invalid-bounce' : ''}
                />
                {formData.uses_meals === 'true' && requiredFieldErrors.meal_rate && (
                  <div className="field-required-message">To pole jest wymagane.</div>
                )}
                {formData.uses_meals !== 'true' && (
                  <div className="field-disabled-message">Pole nieaktywne, gdy dziecko nie korzysta z posiłków.</div>
                )}
              </div>

              {/* LISTA WYBORU RODZICÓW */}
              <div className="form-group full-width">
                <label>Przypisz Rodziców (Max 2) <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  placeholder="Szukaj po imieniu i nazwisku..."
                  value={parentSearchQuery}
                  onChange={(e) => setParentSearchQuery(e.target.value)}
                  style={{ marginBottom: '10px' }}
                />
                <div className={`checkbox-list parent-checkbox-list ${invalidFields.parents ? 'invalid-bounce' : ''}`}>
                  {filteredParents.map(p => (
                    <div key={p.id} className="checkbox-item">
                      <input 
                        id={`parent-${p.id}`}
                        type="checkbox" 
                        checked={formData.parents.includes(p.id)}
                        onChange={() => handleParentToggle(p.id)}
                      />
                      <label htmlFor={`parent-${p.id}`} className="parent-checkbox-label">
                        {p.first_name} {p.last_name} (@{p.username})
                      </label>
                    </div>
                  ))}
                  {filteredParents.length === 0 && (
                    <div className="checkbox-item" style={{ color: '#777' }}>
                      Brak rodziców pasujących do wyszukiwania.
                    </div>
                  )}
                </div>
                {parentLimitError && (
                  <div className="field-required-message">{parentLimitError}</div>
                )}
                {!parentLimitError && requiredFieldErrors.parents && (
                  <div className="field-required-message">Wybierz co najmniej jednego rodzica.</div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Informacje Medyczne</label>
                <textarea 
                   className="medical-textarea" 
                   style={{height: '80px'}}
                   value={formData.medical_info}
                   onChange={e => setFormData({...formData, medical_info: e.target.value})}
                />
              </div>

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
            <h3>Usunąć kartotekę dziecka?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć kartotekę dziecka
              {` "${deleteTarget.first_name} ${deleteTarget.last_name}"`}
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

    </div>
  );
};

export default DirectorChildren;