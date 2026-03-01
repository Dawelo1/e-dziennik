# 🏫 Przedszkole API

Kompleksowa platforma zarządzania przedszkolem z backendem Django REST API i frontendem React Vite. Aplikacja umożliwia zarządzanie rodzinami, posiłkami, płatościami, galerią, harmonogramem i komunikacją.

## 🎯 O projekcie

System do pełnego zarządzania przedszkolem, obejmujący:
- 👨‍👩‍👧‍👦 Zarządzanie użytkownikami i rodzinami
- 🍽️ Planowanie i zarządzanie posiłkami
- 💰 Obsługa płatności i opłat
- 📅 Harmonogram i obecności
- 🖼️ Galeria zdjęć
- 💬 System wiadomości i powiadomień
- 📊 Dashboard i raportowanie

## 🛠️ Tech Stack

### Backend
- **Django 4.2** - Framework web
- **Django REST Framework** - API REST
- **Django Channels** - WebSocket (real-time chat)
- **Redis (channels-redis)** - Channel layer pod produkcję
- **SQLite3** - Baza danych
- **Pillow** - Przetwarzanie obrazów
- **django-cors-headers** - CORS
- **django-rest-passwordreset** - Resetowanie haseł
- **django-cryptography** - Szyfrowanie danych

### Frontend
- **React 18** - Biblioteka UI
- **Vite** - Build tool
- **ESLint** - Linting

## 📋 Wymagania

- Python 3.8+
- Node.js 16+
- npm lub yarn

## 🚀 Instalacja

### Backend

1. Klonuj repozytorium:
```bash
git clone <repo-url>
cd przedszkole_api
```

2. Utwórz środowisko wirtualne:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. Zainstaluj zależności:
```bash
pip install -r requirements.txt
```

4. Przygotuj bazę danych:
```bash
python manage.py migrate
python manage.py createsuperuser
```

5. Uruchom serwer deweloperski:
```bash
python manage.py runserver
```

Backend będzie dostępny na `http://localhost:8000/admin`

### Frontend

1. Przejdź do folderu frontend:
```bash
cd frontend
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Uruchom serwer deweloperski:
```bash
npm run dev
```

Frontend będzie dostępny na `http://localhost:5173`

## 📁 Struktura projektu

```
przedszkole_api/
├── backend/
│   ├── config/              # Ustawienia Django
│   ├── users/               # App - Zarządzanie użytkownikami
│   ├── core/                # App - Główna logika biznesowa
│   ├── communication/       # App - Wiadomości i powiadomienia
│   ├── manage.py
│   └── db.sqlite3
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔧 Komendy zarządzania

### Generowanie płatności za posiłki
```bash
python manage.py generate_meal_payments
```

### Przetwarzanie płatności cyklicznych
```bash
python manage.py process_recurring
```

## 🕒 Zegar testowy (backend + frontend)

Do testów mechanizmów czasowych możesz ręcznie ustawić datę systemową aplikacji bez zmiany zegara OS.

- Panel: **Dyrektor → Ustawienia → Zegar Testowy**
- Endpoint API: `GET/POST /api/debug/test-clock/` (tylko dyrektor)
- Działa tylko w trybie developerskim (`DEBUG=True`)

Przykład ustawienia przez API:

```bash
curl -X POST http://127.0.0.1:8000/api/debug/test-clock/ \
	-H "Authorization: Token <TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{"datetime":"2026-03-15T08:30:00"}'
```

Wyłączenie zegara testowego:

```bash
curl -X POST http://127.0.0.1:8000/api/debug/test-clock/ \
	-H "Authorization: Token <TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{"datetime":null}'
```

Jeśli chcesz całkowicie wyłączyć funkcję, ustaw zmienną środowiskową:

```bash
ENABLE_TEST_CLOCK=0
```

## 📚 Aplikacje Django

### users
Zarządzanie użytkownikami, autentykacją, profilami i awatarami.

### core
Główne funkcjonalności:
- Modele: Rodziny, Dzieci, Posiłki, Płatności, Galeria, Posty
- Admin site
- Middleware
- Zarządzanie zamknięciami placówki i aktywnościami specjalnymi

### communication
System komunikacji:
- Wiadomości między użytkownikami
- Powiadomienia
- Komentarze i polubienia

## 🔐 Bezpieczeństwo

- Autentykacja Token-based
- CORS skonfigurowany
- Szyfrowanie wrażliwych danych
- Password reset z tokenem ważnym 24h

## 📦 Wdrażanie

Projekt jest gotowy do wdrożenia na serwerach produkcyjnych. Pamiętaj o:

1. Ustawieniu `DEBUG = False` w settings.py
2. Ustawieniu bezpiecznego `SECRET_KEY`
3. Konfiguracji `ALLOWED_HOSTS`
4. Użyciu produkcyjnej bazy danych (np. PostgreSQL)
5. Setupie serwera statycznych plików

### WebSocket (chat) – produkcja

System wiadomości działa w czasie rzeczywistym przez WebSocket (`/ws/chat/`) i nie używa pollingu.

1. Uruchamiaj aplikację przez ASGI (np. `daphne` / `uvicorn`), nie tylko WSGI.
2. Ustaw `REDIS_URL`, aby włączyć produkcyjny channel layer (domyślnie bez tej zmiennej działa warstwa in-memory).
3. Frontend może używać domyślnego URL `ws://127.0.0.1:8000/ws/chat/` albo zmiennej:
	- `VITE_WS_CHAT_URL=wss://twoja-domena/ws/chat/`
4. WebSocket autoryzuje użytkownika przez token (`?token=...`) zgodny z obecnym logowaniem DRF TokenAuth.

## 🤝 Contributing

1. Utwórz branch dla nowej funkcjonalności (`git checkout -b feature/AmazingFeature`)
2. Zacommituj zmiany (`git commit -m 'Add some AmazingFeature'`)
3. Pushuj do brancha (`git push origin feature/AmazingFeature`)
4. Otwórz Pull Request

## 📝 Licencja

Projekt jest dostępny na licencji MIT.

## 👨‍💻 Autor

Daniel Pietruczyk-Phan

## 📞 Kontakt i Wsparcie

W przypadku pytań lub problemów, skontaktuj się z administratorem projektu.

---

**Ostatnia aktualizacja:** Grudzień 2025
