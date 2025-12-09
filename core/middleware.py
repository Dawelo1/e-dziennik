# core/middleware.py
from django.core.cache import cache
from rest_framework.authtoken.models import Token

class ActiveDirectorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Najpierw wykonaj zapytanie (widok)
        response = self.get_response(request)

        # 2. Teraz sprawdź status (PO wykonaniu widoku)
        # Dzięki temu, jeśli widokiem było "Wyloguj", to token już został usunięty
        # i poniższy kod nie przywróci statusu Online.

        if request.user and request.user.is_authenticated:
            if getattr(request.user, 'is_director', False):
                
                # Ignoruj ścieżkę wylogowania dla pewności
                if '/logout/' not in request.path:
                    
                    # --- NUCLEAR FIX ---
                    # Sprawdzamy, czy Token nadal fizycznie istnieje w bazie.
                    # Jeśli LogoutView zadziałał, tokena już nie ma, więc nie wejdziemy do środka.
                    try:
                        Token.objects.get(user=request.user)
                        
                        # Token istnieje = Dyrektor jest naprawdę zalogowany
                        cache_key = f'director_online_{request.user.id}'
                        cache.set(cache_key, True, 300)
                        
                    except Token.DoesNotExist:
                        # Token usunięty (właśnie nastąpiło wylogowanie),
                        # więc NIE ustawiamy statusu online.
                        pass

        return response