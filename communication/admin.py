from django.contrib import admin
from .models import Message

class MessageAdmin(admin.ModelAdmin):
    # 1. Kolumny widoczne na liście
    list_display = ('sender', 'receiver', 'subject', 'created_at', 'is_read')
    
    # 2. Filtry po prawej stronie (szybkie szukanie nieprzeczytanych wiadomości)
    list_filter = ('is_read', 'created_at')
    
    # 3. Wyszukiwarka (szukaj po temacie, nazwie nadawcy lub odbiorcy)
    search_fields = ('subject', 'sender__username', 'sender__last_name', 'receiver__username', 'receiver__last_name')
    
    # 4. Pola tylko do odczytu (żebyś przez przypadek nie edytował daty wysłania)
    readonly_fields = ('created_at',)
    
    # 5. Sortowanie (najnowsze na górze)
    ordering = ('-created_at',)

admin.site.register(Message, MessageAdmin)