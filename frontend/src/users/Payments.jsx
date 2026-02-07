import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Payments.css';
import LoadingScreen from './LoadingScreen';
import { getAuthHeaders } from '../authUtils';
import { 
  FaMoneyBillWave, 
  FaCopy, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaHistory,
  FaChevronDown,
  FaChevronUp,
  FaCalendarCheck
} 
from 'react-icons/fa';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedIban, setCopiedIban] = useState(false);
  
  // Nowy stan do ukrywania/pokazywania historii
  const [showHistory, setShowHistory] = useState(false);

  const ibanNumber = 'PL 12 3456 0000 1111 2222 3333 4444';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/payments/', getAuthHeaders());
        // Sortowanie: najnowsze na górze
        const sorted = res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setPayments(sorted);
      } catch (err) {
        console.error("Błąd pobierania:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyIban = () => {
    navigator.clipboard.writeText(ibanNumber.replace(/\s/g, ''));
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  };

  // Filtrowanie płatności
  const unpaidPayments = payments.filter(p => !p.is_paid);
  const paidPayments = payments.filter(p => p.is_paid);

  // Suma do zapłaty
  const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  if (loading) return <LoadingScreen message="Wczytywanie płatności..." />;

  return (
    <div className="payments-container">
      
      <div className="payments-header">
        <h2 className="page-title">
          <FaMoneyBillWave /> Płatności
        </h2>
      </div>

      {/* --- NOWA, POŁĄCZONA KARTA GÓRNA --- */}
      <div className={`combined-info-card ${totalUnpaid > 0 ? 'has-debt' : 'all-clear'}`}>
        
        {/* LEWA STRONA: SUMA */}
        <div className="info-section-left">
          <span className="info-label">Łącznie do zapłaty:</span>
          <span className="total-amount-large">{totalUnpaid.toFixed(2)} zł</span>
          {totalUnpaid === 0 && (
            <div className="success-badge">
              <FaCheckCircle /> Wszystko uregulowane
            </div>
          )}
        </div>

        {/* PRAWA STRONA: DANE DO PRZELEWU */}
        <div className="info-section-right">
          <h4 className="bank-title">Dane do przelewu:</h4>
          <p className="bank-name">Przedszkole "Pszczółka Maja"</p>
          <div 
            className="iban-box copyable" 
            onClick={handleCopyIban}
            title="Kliknij aby skopiować"
          >
            <code>{ibanNumber}</code>
            <span className="copy-icon">
              {copiedIban ? <FaCheckCircle color="green"/> : <FaCopy />}
            </span>
          </div>
          <p className="bank-warning">W tytule podawaj WYŁĄCZNIE wygenerowany kod.</p>
        </div>
      </div>

      {/* --- SEKCJA 1: DO ZAPŁATY (Zawsze widoczna) --- */}
      <div className="payments-list">
        {unpaidPayments.length === 0 ? (
          // Jeśli nie ma nic do zapłaty, nie wyświetlamy pustej sekcji, 
          // użytkownik widzi zielony komunikat w karcie głównej.
          null 
        ) : (
          unpaidPayments.map(payment => (
            <div key={payment.id} className="payment-card unpaid">
              {/* Opis i Data Wystawienia */}
              <div className="payment-info">
                <div className="payment-description">{payment.description}</div>
                <div className="payment-date">
                  <FaHistory /> Wystawiono: {new Date(payment.created_at).toLocaleDateString()}
                </div>
                {payment.child_name && <div className="payment-child">Dziecko: {payment.child_name}</div>}
              </div>

              {/* Kod do kopiowania */}
              <div className="transfer-data">
                <span className="data-label">TYTUŁ PRZELEWU (KLIKNIJ BY SKOPIOWAĆ):</span>
                <div 
                  className="copy-box" 
                  onClick={() => handleCopy(payment.payment_title, payment.id)}
                >
                  <code>{payment.payment_title}</code>
                  <span className="copy-icon">
                    {copiedId === payment.id ? <FaCheckCircle color="green"/> : <FaCopy />}
                  </span>
                </div>
              </div>

              {/* Kwota i Przycisk "Do zapłaty" */}
              <div className="payment-status-box">
                <div className="payment-amount">{parseFloat(payment.amount).toFixed(2)} zł</div>
                <div className="status-badge status-unpaid">
                  <FaExclamationCircle /> Do zapłaty
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- SEKCJA 2: HISTORIA (Rozwijana) --- */}
      {paidPayments.length > 0 && (
        <div className="history-section">
          
          <button 
            className="toggle-history-btn" 
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? (
              <> <FaChevronUp /> Zwiń historię płatności </>
            ) : (
              <> <FaChevronDown /> Pokaż historię płatności ({paidPayments.length}) </>
            )}
          </button>

          {showHistory && (
            <div className="payments-list history-list">
              {paidPayments.map(payment => (
                <div key={payment.id} className="payment-card paid">
                  
                  <div className="payment-info">
                    <div className="payment-description">{payment.description}</div>
                    {/* TU ZMIANA: Pokazujemy datę wpłaty jeśli jest, lub utworzenia */}
                    <div className="payment-date done">
                      <FaCalendarCheck /> 
                      {payment.payment_date 
                        ? `Opłacono: ${new Date(payment.payment_date).toLocaleDateString()}`
                        : `Opłacono (data nieznana)`
                      }
                    </div>
                  </div>

                  {/* W historii kod przelewu jest mniej ważny, pokazujemy go jako zwykły tekst */}
                  <div className="transfer-data faded">
                    <span className="data-label">Kod: {payment.payment_title}</span>
                  </div>

                  <div className="payment-status-box">
                    <div className="payment-amount">{parseFloat(payment.amount).toFixed(2)} zł</div>
                    <div className="status-badge status-paid">
                      <FaCheckCircle /> Opłacone
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Payments;