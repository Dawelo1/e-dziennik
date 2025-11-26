import random
import string
from django.contrib.auth import get_user_model

def generate_unique_username():
    """
    Generuje login w formacie: p + 5 cyfr + m (np. p12345m).
    Sprawdza w bazie, czy taki login już nie istnieje.
    """
    User = get_user_model()
    while True:
        # Losujemy 5 cyfr
        digits = ''.join(random.choices(string.digits, k=5))
        username = f"p{digits}m"
        
        # Sprawdzamy czy wolny
        if not User.objects.filter(username=username).exists():
            return username

def generate_secure_password():
    """
    Generuje hasło: 10 znaków, cyfry + litery + znaki specjalne.
    """
    length = 10
    # Zbiór znaków: litery duże, małe, cyfry, znaki specjalne (bez problematycznych jak spacja czy cudzysłów)
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    
    while True:
        password = ''.join(random.choices(characters, k=length))
        # Upewniamy się, że hasło jest wystarczająco "silne" (ma min. 1 cyfrę i 1 znak specjalny)
        if (any(c.isdigit() for c in password) and 
            any(c in "!@#$%^&*" for c in password)):
            return password