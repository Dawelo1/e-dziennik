// frontend/src/Payments.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Payments.css';
import { 
  FaMoneyBillWave, 
  FaCopy, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaHistory 
} from 'react-icons/fa';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null); // Do animacji "Skopiowano!"

  // Obliczamy sumę do zapłaty
  const totalUnpaid = payments
    .filter(p => !p.is_paid)
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Token ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/payments/', getAuthHeaders());
        // Sortujemy: Najpierw nieopłacone, potem wg daty (najnowsze wyżej)
        const sorted = res.data.sort((a, b) => {
          if (a.is_paid === b.is_paid) {
            return new Date(b.created_at) - new Date(a.created_at);
          }
          return a.is_paid ? 1 : -1;
        });
        setPayments(sorted);
      } catch (err) {
        console.error("Błąd pobierania płatności:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Funkcja kopiowania tytułu przelewu
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000); // Reset komunikatu po 2s
  };

  if (loading) return <div className="loading-state">Ładowanie płatności... 🐝</div>;

  return (
    <div className="payments-container">
      
      {/* NAGŁÓWEK */}
      <div className="payments-header">
        <h2 className="page-title">
          <FaMoneyBillWave /> Płatności
        </h2>
      </div>

      {/* KARTA PODSUMOWANIA (Tylko jeśli jest coś do zapłaty) */}
      <div className={`summary-card ${totalUnpaid > 0 ? 'debt' : 'clean'}`}>
        <div className="summary-content">
          <span className="summary-label">Łącznie do zapłaty:</span>
          <span className="summary-amount">{totalUnpaid.toFixed(2)} zł</span>
        </div>
        {totalUnpaid === 0 && (
          <div className="clean-state-message">
            <FaCheckCircle /> Wszystkie należności uregulowane!
          </div>
        )}
      </div>

      {/* LISTA PŁATNOŚCI */}
      <div className="payments-list">
        {payments.length === 0 ? (
          <div className="empty-state">Brak historii płatności.</div>
        ) : (
          payments.map(payment => (
            <div 
              key={payment.id} 
              className={`payment-card ${payment.is_paid ? 'paid' : 'unpaid'}`}
            >
              {/* LEWA STRONA: Opis i Data */}
              <div className="payment-info">
                <div className="payment-description">{payment.description}</div>
                <div className="payment-date">
                  <FaHistory /> Wystawiono: {new Date(payment.created_at).toLocaleDateString()}
                </div>
                {/* Imię dziecka (jeśli rodzic ma więcej dzieci) */}
                {payment.child_name && ( // Upewnij się, że serializer zwraca child_name lub child string
                   <div className="payment-child">Dziecko: {payment.child}</div>
                )}
              </div>

              {/* ŚRODEK: Dane do przelewu (tylko dla nieopłaconych) */}
              {!payment.is_paid && (
                <div className="transfer-data">
                  <span className="data-label">Tytuł przelewu (kliknij by skopiować):</span>
                  <div 
                    className="copy-box" 
                    onClick={() => handleCopy(payment.payment_title, payment.id)}
                    title="Kliknij, aby skopiować"
                  >
                    <code>{payment.payment_title}</code>
                    <span className="copy-icon">
                      {copiedId === payment.id ? <FaCheckCircle color="green"/> : <FaCopy />}
                    </span>
                  </div>
                  {copiedId === payment.id && <span className="copied-tooltip">Skopiowano!</span>}
                </div>
              )}

              {/* PRAWA STRONA: Kwota i Status */}
              <div className="payment-status-box">
                <div className="payment-amount">{parseFloat(payment.amount).toFixed(2)} zł</div>
                <div className={`status-badge ${payment.is_paid ? 'status-paid' : 'status-unpaid'}`}>
                  {payment.is_paid ? (
                    <>
                      <FaCheckCircle /> Opłacone
                    </>
                  ) : (
                    <>
                      <FaExclamationCircle /> Do zapłaty
                    </>
                  )}
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* INFORMACJA O NUMERZE KONTA */}
      <div className="bank-info-card">
        <h4>Dane do przelewu:</h4>
        <p>Przedszkole "Pszczółka Maja"</p>
        <p className="iban">PL 12 3456 0000 1111 2222 3333 4444</p>
        <p className="bank-note">W tytule prosimy podawać WYŁĄCZNIE wygenerowany kod.</p>
      </div>

    </div>
  );
};

export default Payments;