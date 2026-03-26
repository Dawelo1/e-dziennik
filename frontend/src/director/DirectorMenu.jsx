import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './Director.css';
import LoadingScreen from '../users/LoadingScreen';
import {
  FaUtensils,
  FaSearch,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaExclamationTriangle,
  FaTrashAlt,
  FaImage
} from 'react-icons/fa';

const getDefaultWeekStartDate = () => {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = localDate.getDay();
  const daysUntilMonday = (8 - dayOfWeek) % 7;
  localDate.setDate(localDate.getDate() + daysUntilMonday);

  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const buildInitialForm = () => ({
  week_start_date: getDefaultWeekStartDate(),
  image: null,
  imagePreview: ''
});

const calculateWeekEndDate = (weekStartDate) => {
  if (!weekStartDate) return '';
  const [year, month, day] = weekStartDate.split('-').map(Number);
  if (!year || !month || !day) return '';

  const localDate = new Date(year, month - 1, day);
  localDate.setDate(localDate.getDate() + 4);

  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatMenuDate = (value) => {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return String(value);
  return `${day}.${month}.${year}`;
};

const parseIsoDate = (value) => {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseSearchDate = (value) => {
  const query = String(value).trim();
  if (!query) return null;

  let match = query.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  match = query.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  return null;
};

const parseSearchDayMonth = (value) => {
  const query = String(value).trim();
  if (!query) return null;

  const match = query.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month };
};

const isDayMonthWithinRange = (startDate, endDate, day, month) => {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return false;

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  while (cursor <= endDate) {
    if (cursor.getDate() === day && cursor.getMonth() + 1 === month) return true;
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
};

const DirectorMenu = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [formData, setFormData] = useState(buildInitialForm);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currentPreviewImage = formData.imagePreview || editingMenu?.image;
  const hasExistingImage = Boolean(editingMenu?.image);
  const hasSelectedNewImage = Boolean(formData.image);
  const currentWeekEndDate = formData.week_start_date
    ? calculateWeekEndDate(formData.week_start_date)
    : (editingMenu?.week_end_date || '');

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/menu/', getAuthHeaders());
      setMenus(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalizeDateSearch = (value = '') =>
    String(value)
      .replace(/(^|[^\d])0(?=\d)/g, '$1')
      .toLowerCase();

  const filteredMenus = menus
    .filter((menu) => {
      const query = searchQuery.trim();
      if (!query) return true;

      const searchedDate = parseSearchDate(query);
      const searchedDayMonth = parseSearchDayMonth(query);
      if (searchedDate) {
        const startDate = parseIsoDate(menu.week_start_date);
        const endDate = parseIsoDate(menu.week_end_date);

        if (startDate && endDate) {
          return searchedDate >= startDate && searchedDate <= endDate;
        }
      }

      if (searchedDayMonth) {
        const startDate = parseIsoDate(menu.week_start_date);
        const endDate = parseIsoDate(menu.week_end_date);

        if (startDate && endDate) {
          return isDayMonthWithinRange(startDate, endDate, searchedDayMonth.day, searchedDayMonth.month);
        }
      }

      const normalizedQuery = normalizeDateSearch(query.toLowerCase());
      const values = [
        menu.week_start_date,
        menu.week_end_date,
        formatMenuDate(menu.week_start_date),
        formatMenuDate(menu.week_end_date),
        `${menu.week_start_date} ${menu.week_end_date}`,
        `${formatMenuDate(menu.week_start_date)} ${formatMenuDate(menu.week_end_date)}`
      ];

      return values.some((value) => normalizeDateSearch(value).includes(normalizedQuery));
    })
    .sort((a, b) => new Date(`${b.week_start_date}T00:00:00`) - new Date(`${a.week_start_date}T00:00:00`));

  const openModal = (menu = null) => {
    setError('');
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        week_start_date: menu.week_start_date,
        image: null,
        imagePreview: menu.image || ''
      });
    } else {
      setEditingMenu(null);
      setFormData(buildInitialForm());
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(buildInitialForm());
    setEditingMenu(null);
    setError('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      image: file,
      imagePreview: file ? URL.createObjectURL(file) : prev.imagePreview
    }));
  };

  const clearSelectedImage = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setFormData((prev) => ({
      ...prev,
      image: null,
      imagePreview: editingMenu?.image || ''
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.week_start_date) {
      setError('Wymagana jest data rozpoczęcia tygodnia.');
      return;
    }

    const startDay = new Date(`${formData.week_start_date}T00:00:00`).getDay();
    if (startDay !== 1) {
      setError('Tydzień musi zaczynać się w poniedziałek.');
      return;
    }

    if (!editingMenu && !formData.image) {
      setError('Dodaj zdjęcie jadłospisu.');
      return;
    }

    const payload = new FormData();
    payload.append('week_start_date', formData.week_start_date);
    if (formData.image) payload.append('image', formData.image);

    setLoading(true);
    try {
      if (editingMenu) {
        await axios.patch(`/api/menu/${editingMenu.id}/`, payload, getAuthHeaders());
      } else {
        await axios.post('/api/menu/', payload, getAuthHeaders());
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setError('Błąd zapisu. Sprawdź, czy na ten dzień nie ma już wpisu.');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    setLoading(true);
    try {
      await axios.delete(`/api/menu/${deleteTarget.id}/`, getAuthHeaders());
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setActionError('Nie udało się usunąć pozycji jadłospisu.');
      setLoading(false);
    }
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

      <div className="filter-bar">
        <div className="search-bar-container" style={{ flex: 1, margin: 0 }}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Szukaj po dacie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Zdjęcie Jadłospisu
        </button>
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Tydzień</th>
              <th>Podgląd</th>
              <th className="actions-header">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredMenus.map((menu) => (
              <tr key={menu.id}>
                <td style={{ fontWeight: 700 }}>
                  {formatMenuDate(menu.week_start_date)} - {formatMenuDate(menu.week_end_date)}
                </td>
                <td>
                  {menu.image ? (
                    <img
                      src={menu.image}
                      alt={`Jadłospis ${menu.week_start_date}`}
                      style={{ width: 180, maxWidth: '100%', borderRadius: 10, border: '1px solid #eee' }}
                    />
                  ) : (
                    'Brak zdjęcia'
                  )}
                </td>
                <td className="actions-cell">
                  <button className="action-icon-btn edit" onClick={() => openModal(menu)} title="Edytuj wpis">
                    <FaEdit />
                  </button>
                  <button
                    className="action-icon-btn delete"
                    onClick={() => {
                      setActionError('');
                      setDeleteTarget(menu);
                    }}
                    title="Usuń wpis"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
            {filteredMenus.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center">Brak wpisów dla podanego filtra.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{ maxWidth: 700 }}>
            <h3>
              {editingMenu
                ? `Edytuj tydzień: ${formatMenuDate(formData.week_start_date)} - ${formatMenuDate(currentWeekEndDate)}`
                : 'Nowy wpis jadłospisu'}
            </h3>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} noValidate>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Data rozpoczęcia tygodnia (poniedziałek)</label>
                <input
                  type="date"
                  required
                  value={formData.week_start_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, week_start_date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20, color: '#666', fontSize: 13 }}>
                Data zakończenia: {formatMenuDate(currentWeekEndDate)}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <div className="menu-upload-title">Zdjęcie tygodniowej rozpiski</div>
                <input
                  id="menu-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="menu-upload-input"
                />
                <label htmlFor="menu-image-upload" className="menu-upload-box">
                  {currentPreviewImage ? (
                    <div className="menu-upload-preview-wrapper">
                      <div className="menu-upload-preview-frame">
                        {hasSelectedNewImage && (
                          <button
                            type="button"
                            className="post-image-delete-btn"
                            onClick={clearSelectedImage}
                            title="Usuń zdjęcie"
                            aria-label="Usuń zdjęcie"
                          >
                            <FaTrashAlt className="post-image-delete-icon" />
                          </button>
                        )}
                        <img
                          src={currentPreviewImage}
                          alt="Podgląd jadłospisu"
                          className="menu-upload-preview"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="menu-upload-placeholder">
                      <FaImage className="menu-upload-icon" />
                      <span>
                        {hasExistingImage ? 'Kliknij, aby podmienić zdjęcie' : 'Kliknij, aby dodać zdjęcie'}
                      </span>
                    </div>
                  )}
                </label>
              </div>

              <div className="modal-actions full-width" style={{ marginTop: 30 }}>
                <button type="button" className="modal-btn cancel" onClick={closeModal}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success">
                  <FaSave /> Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="delete-modal-content">
            <div className="warning-icon"><FaExclamationTriangle /></div>
            <h3>Usunąć wpis jadłospisu?</h3>
            <p>
              Czy na pewno chcesz trwale usunąć wpis z tygodnia
              {` "${formatMenuDate(deleteTarget.week_start_date)} - ${formatMenuDate(deleteTarget.week_end_date)}"`}
              ?
            </p>
            {actionError && <div className="form-error">{actionError}</div>}
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => {
                  setActionError('');
                  setDeleteTarget(null);
                }}
              >
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

export default DirectorMenu;