// frontend/src/director/DirectorDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../authUtils';
import './DirectorDashboard.css'; // Nowy plik CSS
import LoadingScreen from '../users/LoadingScreen';
import { NavLink } from 'react-router-dom';

import { 
  FaChartLine, FaUserCheck, FaUserSlash, FaMoneyBillWave, FaEnvelope
} from 'react-icons/fa';

const DirectorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceRange, setAttendanceRange] = useState('week');
  const [attendanceGroup, setAttendanceGroup] = useState('all');
  const [debtGroup, setDebtGroup] = useState('all');
  const [selectedDebtorId, setSelectedDebtorId] = useState(null);
  const unansweredSectionRef = useRef(null);

  const attendanceGroups = stats?.attendance?.groups || [];
  const debtStats = stats?.debts || {};

  const attendanceSeries = stats?.attendance?.[attendanceRange]?.[attendanceGroup] || [];

  const selectedGroupDebt = useMemo(() => {
    if (debtGroup === 'all') {
      return debtStats.total_outstanding || 0;
    }
    const found = (debtStats.by_group || []).find(group => String(group.group_id) === String(debtGroup));
    return found?.amount || 0;
  }, [debtGroup, debtStats]);

  const filteredDebtors = useMemo(() => {
    const debtors = debtStats.debtors || [];
    if (debtGroup === 'all') {
      return debtors;
    }

    return debtors.filter(debtor => debtor.debts.some(debt => String(debt.group_id) === String(debtGroup)));
  }, [debtGroup, debtStats]);

  const selectedDebtor = useMemo(() => {
    if (!selectedDebtorId) return null;
    return filteredDebtors.find(debtor => debtor.parent_id === selectedDebtorId) || null;
  }, [filteredDebtors, selectedDebtorId]);

  const unansweredOver24h = stats?.unanswered_over_24h || [];
  const unansweredOver24hCount = stats?.unanswered_over_24h_count || 0;

  const formatCurrency = (value) => {
    const number = Number(value) || 0;
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const getTodayIsoDate = () => {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localNow.toISOString().split('T')[0];
  };

  const scrollToUnansweredSection = () => {
    unansweredSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/director/stats/', getAuthHeaders());
        setStats(res.data);

        const firstDebtor = res.data?.debts?.debtors?.[0];
        if (firstDebtor?.parent_id) {
          setSelectedDebtorId(firstDebtor.parent_id);
        }
      } catch (err) {
        console.error("Błąd pobierania statystyk:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingScreen message="Wczytywanie pulpitu..." />;
  }

  return (
    <div className="director-container">
      <h2 className="page-title">
        <FaChartLine /> Pulpit Zarządczy
      </h2>
      
      {/* SIATKA STATYSTYK */}
      <div className="stats-grid">
        
        {/* 1. Obecni */}
        <NavLink to={`/director/attendance?day=${getTodayIsoDate()}`} className="stat-card blue">
          <div className="stat-icon"><FaUserCheck /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.present_today} / {stats?.total_children}</span>
            <span className="stat-label">Dzieci Obecnych Dzisiaj</span>
          </div>
        </NavLink>
        
        {/* 2. Nieobecni */}
        <NavLink to={`/director/attendance?week=${getTodayIsoDate()}`} className="stat-card orange">
          <div className="stat-icon"><FaUserSlash /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.absent_week ?? stats?.absent_today}</span>
            <span className="stat-label">Nieobecności W Tygodniu</span>
          </div>
        </NavLink>

        {/* 3. Wiadomości bez odpowiedzi >24h */}
        <button
          type="button"
          className="stat-card red stat-card-button"
          onClick={scrollToUnansweredSection}
        >
          <div className="stat-icon"><FaEnvelope /></div>
          <div className="stat-content">
            <span className="stat-value">{unansweredOver24hCount}</span>
            <span className="stat-label">Wiadomości Bez Odpowiedzi &gt; 24h</span>
          </div>
        </button>

        {/* 4. Zaległości */}
        <NavLink to="/director/payments?debt=1" className="stat-card green">
          <div className="stat-icon"><FaMoneyBillWave /></div>
          <div className="stat-content">
            <span className="stat-value">{formatCurrency(stats?.debts?.total_outstanding)}</span>
            <span className="stat-label">Łączne Zaległości Rodziców</span>
          </div>
        </NavLink>

      </div>

      <section className="dashboard-section">
        <div className="section-header-row">
          <h3 className="section-title">Frekwencja - wykres</h3>
          <div className="attendance-controls">
            <div className="toggle-group">
              <button
                type="button"
                className={attendanceRange === 'week' ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setAttendanceRange('week')}
              >
                Tydzień
              </button>
              <button
                type="button"
                className={attendanceRange === 'month' ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setAttendanceRange('month')}
              >
                Miesiąc
              </button>
            </div>

            <select
              className="group-select"
              value={attendanceGroup}
              onChange={(e) => setAttendanceGroup(e.target.value)}
            >
              {attendanceGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="attendance-chart-card">
          <div className="attendance-chart">
            {attendanceSeries.map(point => (
              <div key={point.date} className="attendance-bar-item" title={`${point.label}: ${point.present}/${point.total} (${point.attendance_rate}%)`}>
                <div className="attendance-bar-track">
                  <div
                    className="attendance-bar-fill"
                    style={{ height: `${Math.max(Number(point.attendance_rate) || 0, 4)}%` }}
                  />
                </div>
                <span className="attendance-bar-label">{point.label}</span>
              </div>
            ))}
          </div>
          <div className="attendance-summary-row">
            <span>
              Średnia frekwencja:{' '}
              <strong>
                {attendanceSeries.length
                  ? `${(
                      attendanceSeries.reduce((sum, point) => sum + (Number(point.attendance_rate) || 0), 0) / attendanceSeries.length
                    ).toFixed(1)}%`
                  : '0.0%'}
              </strong>
            </span>
            <span>
              Zakres: <strong>{attendanceRange === 'week' ? '7 dni' : '30 dni'}</strong>
            </span>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-header-row">
          <h3 className="section-title">Zaległości rodziców</h3>
          <select
            className="group-select"
            value={debtGroup}
            onChange={(e) => {
              setDebtGroup(e.target.value);
              setSelectedDebtorId(null);
            }}
          >
            <option value="all">Cała placówka</option>
            {(debtStats.by_group || []).map(group => (
              <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
            ))}
          </select>
        </div>

        <div className="debt-summary-grid">
          <div className="debt-summary-card">
            <span className="debt-summary-label">Zaległość ({debtGroup === 'all' ? 'całość' : 'wybrana grupa'})</span>
            <span className="debt-summary-value">{formatCurrency(selectedGroupDebt)}</span>
          </div>
          <div className="debt-summary-card">
            <span className="debt-summary-label">Liczba nieopłaconych pozycji</span>
            <span className="debt-summary-value">{debtStats.total_unpaid_items || 0}</span>
          </div>
          <div className="debt-summary-card">
            <span className="debt-summary-label">Największa zaległość</span>
            <span className="debt-summary-value">
              {debtStats.top_debtor ? `${debtStats.top_debtor.parent_name} (${formatCurrency(debtStats.top_debtor.amount)})` : 'Brak'}
            </span>
          </div>
        </div>

        <div className="debt-layout-grid">
          <div className="debtors-list-card">
            <h4>Rodzice z zaległościami</h4>
            <div className="debtors-list">
              {filteredDebtors.length === 0 && (
                <div className="empty-state">Brak zaległości dla wybranego zakresu.</div>
              )}

              {filteredDebtors.map(debtor => (
                <button
                  type="button"
                  key={debtor.parent_id}
                  className={selectedDebtorId === debtor.parent_id ? 'debtor-item active' : 'debtor-item'}
                  onClick={() => setSelectedDebtorId(debtor.parent_id)}
                >
                  <div>
                    <strong>{debtor.parent_name}</strong>
                    <span>{debtor.group_names.join(', ')}</span>
                  </div>
                  <span>{formatCurrency(debtor.amount)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="debtor-details-card">
            <h4>Szczegóły zaległości</h4>
            {!selectedDebtor && (
              <div className="empty-state">Wybierz rodzica z listy, aby podejrzeć szczegóły zaległości.</div>
            )}

            {selectedDebtor && (
              <>
                <div className="debtor-details-header">
                  <strong>{selectedDebtor.parent_name}</strong>
                  <span>Łącznie: {formatCurrency(selectedDebtor.amount)}</span>
                </div>
                <div className="debtor-details-table-wrap">
                  <table className="debtor-details-table">
                    <thead>
                      <tr>
                        <th>Dziecko</th>
                        <th>Grupa</th>
                        <th>Opis</th>
                        <th>Kwota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDebtor.debts
                        .filter(debt => debtGroup === 'all' || String(debt.group_id) === String(debtGroup))
                        .map(debt => (
                          <tr key={debt.payment_id}>
                            <td>{debt.child_name}</td>
                            <td>{debt.group_name}</td>
                            <td>{debt.description}</td>
                            <td>{formatCurrency(debt.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-section" ref={unansweredSectionRef}>
        <div className="section-header-row">
          <h3 className="section-title">Wiadomości bez odpowiedzi ponad 24h</h3>
        </div>

        <div className="pending-replies-card">
          {unansweredOver24h.length === 0 && (
            <div className="empty-state">Brak rozmów oczekujących ponad 24h.</div>
          )}

          {unansweredOver24h.map(item => (
            <NavLink
              key={item.participant_id}
              className="pending-reply-item"
              to={`/director/messages?participant=${item.participant_id}`}
            >
              <div>
                <strong>{item.participant_name}</strong>
                <span>Wiadomość: {item.last_message_preview || 'Brak podglądu wiadomości'}</span>
              </div>
              <span className="pending-hours">{item.hours_waiting}h</span>
            </NavLink>
          ))}
        </div>

      </section>

    </div>
  );
};

export default DirectorDashboard;