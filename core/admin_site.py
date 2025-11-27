from django.contrib import admin
from django.contrib.admin.apps import AdminConfig

class CustomAdminSite(admin.AdminSite):
    # Możesz tu zmienić nagłówek strony
    site_header = "Administracja Przedszkole Pszczółka Maja"
    site_title = "Panel Dyrektora"
    index_title = "Witaj w panelu zarządzania"

    def get_app_list(self, request):
        """
        Ta metoda odpowiada za pobranie i posortowanie listy aplikacji i modeli.
        """
        # 1. Pobieramy standardową listę z Django
        app_list = super().get_app_list(request)

        # 2. Definiujemy naszą wymarzoną kolejność APLIKACJI (wg 'app_label')
        # Używamy nazw systemowych aplikacji (tych z apps.py name='...')
        app_order = {
            'core': 1,                      # Zarządzanie Przedszkolem
            'communication': 2,             # Komunikacja
            'users': 3,                     # Użytkownicy
            'authtoken': 4,                 # Token
            'django_rest_passwordreset': 5  # Reset hasła
        }

        # 3. Definiujemy kolejność MODELI wewnątrz aplikacji 'core' (wg 'object_name')
        # Używamy nazw klas modeli (np. Attendance, DailyMenu)
        core_model_order = {
            'Attendance': 1,        # Obecności
            'DailyMenu': 2,         # Jadłospis
            'SpecialActivity': 3,   # Plan zajęć
            'Payment': 4,           # Płatności
            'Post': 5,              # Tablica Aktualności
            'FacilityClosure': 6,   # Dni wolne
            'Child': 7,              # Dzieci
            'Group': 8,             # Grupy
        }

        # --- SORTOWANIE ---

        # Sortujemy aplikacje
        app_list.sort(key=lambda x: app_order.get(x['app_label'], 100))

        # Sortujemy modele wewnątrz każdej aplikacji
        for app in app_list:
            if app['app_label'] == 'core':
                app['models'].sort(key=lambda x: core_model_order.get(x['object_name'], 100))
            
            # Możesz tu dodać sortowanie dla innych aplikacji jeśli chcesz

        return app_list
    
class CoreAdminConfig(AdminConfig):
    """
    Konfiguracja, która podmienia domyślny panel admina na nasz CustomAdminSite.
    """
    default_site = 'core.admin_site.CustomAdminSite'