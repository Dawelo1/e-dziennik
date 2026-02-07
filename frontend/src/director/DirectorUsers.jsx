// frontend/src/director/DirectorUsers.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorUsers.css';

// --- NOWY IMPORT ---
import LoadingScreen from '../users/LoadingScreen'; 

// Ikony
import { 
  FaUsers, FaSearch, FaPlus, FaEdit, FaTrash, 
  FaUserTie, FaUser, FaKey, FaSave 
} from 'react-icons/fa';

const DirectorUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Stan Modala
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); 

  // Formularz
  const initialForm = {
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');

  // 1. Pobieranie użytkowników
  const fetchUsers = async () => {
    // Nie włączamy loading przy każdym wpisaniu litery w szukajkę, 
    // żeby ekran nie migał pszczółką przy pisaniu.
    // Ale przy pierwszym ładowaniu - tak.
    if (users.length === 0) setLoading(true); 

    try {
      const url = `http://127.0.0.1:8000/api/users/manage/?search=${searchQuery}`;
      const res = await axios.get(url, getAuthHeaders());
      setUsers(res.data);
    } catch (err) {
      console.error("Błąd pobierania użytkowników:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 2. Otwieranie Modala
  const openModal = (user = null) => {
    setError('');
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email || '',
        phone_number: user.phone_number || '',
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  // 3. Zapisywanie
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    // Włączamy loading na czas zapisu - pojawi się pszczółka
    setLoading(true);

    const payload = {
      ...formData,
      is_director: false,
      is_parent: true
    };

    if (editingUser && !payload.password) {
      delete payload.password;
    }

    try {
      if (editingUser) {
        await axios.patch(
          `http://127.0.0.1:8000/api/users/manage/${editingUser.id}/`, 
          payload, 
          getAuthHeaders()
        );
      } else {
        await axios.post(
          'http://127.0.0.1:8000/api/users/manage/', 
          payload, 
          getAuthHeaders()
        );
      }
      setIsModalOpen(false);
      // Pobieramy dane ponownie (loading zostanie wyłączony w fetchUsers)
      fetchUsers(); 
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.username 
        ? `Nazwa użytkownika zajęta: ${err.response.data.username}` 
        : 'Wystąpił błąd zapisu.';
      setError(msg);
      setLoading(false); // Wyłączamy loading w przypadku błędu
    }
  };

  // 4. Usuwanie
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego użytkownika? To operacja nieodwracalna.")) return;
    
    setLoading(true); // Pszczółka podczas usuwania
    try {
      await axios.delete(`http://127.0.0.1:8000/api/users/manage/${id}/`, getAuthHeaders());
      fetchUsers();
    } catch (err) {
      alert("Nie udało się usunąć użytkownika.");
      setLoading(false);
    }
  };

  // --- ZMIANA: EKRAN ŁADOWANIA ---
  // Wyświetlamy go, gdy trwa pobieranie danych LUB zapisywanie
  if (loading && users.length === 0) {
     // Wersja dla pierwszego wejścia (pełny ekran)
     return <LoadingScreen message="Wczytywanie listy użytkowników..." />;
  }

  // Wersja "Overlay" gdy zapisujemy (opcjonalnie, można to też obsłużyć inaczej)
  // Tutaj używam prostej logiki: jeśli loading jest true (np. przy zapisie), 
  // zwracamy LoadingScreen zamiast tabeli.
  if (loading) {
      return <LoadingScreen message="Przetwarzanie danych..." />;
  }

  return (
    <div className="director-container">
      
      <div className="page-header-row">
        <h2 className="page-title">
          <FaUsers /> Zarządzanie Użytkownikami
        </h2>
        <button className="honey-btn" onClick={() => openModal()}>
          <FaPlus /> Dodaj Użytkownika
        </button>
      </div>

      <div className="search-bar-container">
        <FaSearch className="search-icon"/>
        <input 
          type="text" 
          placeholder="Szukaj po imieniu, nazwisku, loginie..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="table-card">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Użytkownik</th>
              <th>Imię i Nazwisko</th>
              <th>Kontakt</th>
              <th>Rola</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="5" className="text-center">Brak użytkowników spełniających kryteria.</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className={`avatar-circle ${user.is_director ? 'director' : 'parent'}`}>
                        {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
                      </div>
                      <span className="username-text">{user.username}</span>
                    </div>
                  </td>
                  <td>{user.first_name} {user.last_name}</td>
                  <td>
                    <div className="contact-info">
                      <span>{user.email}</span>
                      <span className="sub-text">{user.phone_number}</span>
                    </div>
                  </td>
                  <td>
                    {user.is_director ? (
                      <span className="role-badge director"><FaUserTie/> Dyrektor</span>
                    ) : (
                      <span className="role-badge parent"><FaUser/> Rodzic</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button className="action-icon-btn edit" onClick={() => openModal(user)} title="Edytuj">
                      <FaEdit />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => handleDelete(user.id)} title="Usuń">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h3>{editingUser ? 'Edytuj Użytkownika' : 'Dodaj Nowego Użytkownika'}</h3>
            
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSave} className="modal-form-grid">
              
              <div className="form-group">
                <label>Login *</label>
                <input 
                  type="text" required
                  placeholder="Login użytkownika"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  disabled={!!editingUser}
                />
              </div>

              <div className="form-group">
                <label>Imię</label>
                <input type="text" placeholder="Imię" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})}/>
              </div>

              <div className="form-group">
                <label>Nazwisko</label>
                <input type="text" placeholder="Nazwisko" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})}/>
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input type="email" placeholder="Adres e-mail" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/>
              </div>

              <div className="form-group">
                <label>Telefon</label>
                <input type="text" placeholder="Numer telefonu" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})}/>
              </div>

              <div className="form-group full-width">
                <label>Hasło {editingUser && <span style={{fontWeight:400, color:'#999'}}>(Zostaw puste, aby nie zmieniać)</span>}</label>
                <div className="password-input-wrapper">
                  <FaKey className="field-icon"/>
                  <input 
                    type="password" 
                    placeholder={editingUser ? "••••••••" : "Wpisz hasło..."}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required={!editingUser} 
                  />
                </div>
              </div>

              <div className="modal-actions full-width">
                <button type="button" className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Anuluj</button>
                <button type="submit" className="modal-btn confirm success"><FaSave /> Zapisz</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DirectorUsers;