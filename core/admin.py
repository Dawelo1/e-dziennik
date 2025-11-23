from django.contrib import admin
from .models import Group, Child, Payment, Post

# Prosta rejestracja - pozwoli dodawać/edytować elementy
admin.site.register(Group)
admin.site.register(Child)
admin.site.register(Payment)
admin.site.register(Post)