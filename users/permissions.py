# users/permissions.py
from rest_framework import permissions

class IsDirector(permissions.BasePermission):
    """
    Pozwala na dostęp tylko użytkownikom z flagą is_director=True.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_director)