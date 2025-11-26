from django.contrib import admin
from django import forms
from django.contrib import messages
from django.contrib.admin.widgets import FilteredSelectMultiple
from .models import Message
from users.models import User

# 1. Klasa pomocnicza do zmiany wyglądu etykiety (Jan Nowak (Pszczółki))
class ParentModelMultipleChoiceField(forms.ModelMultipleChoiceField):
    def label_from_instance(self, obj):
        # POPRAWKA: Używamy .child.all() bo tak masz w related_name w modelu Child
        children = obj.child.all() 
        
        if children:
            # Tworzymy listę grup bez powtórzeń
            group_names = set([c.group.name for c in children if c.group])
            groups_str = ", ".join(group_names)
            return f"{obj.first_name} {obj.last_name} ({groups_str})"
        
        # Fallback jeśli rodzic nie ma jeszcze przypisanego dziecka
        return f"{obj.first_name} {obj.last_name} (Brak przypisanej grupy)"

# 2. Formularz
class MessageAdminForm(forms.ModelForm):
    recipients = ParentModelMultipleChoiceField(
        # POPRAWKA: Tu też zmieniamy na 'child__group' (liczba pojedyncza)
        queryset=User.objects.filter(is_parent=True).prefetch_related('child__group'),
        required=True,
        label="Wybierz odbiorców",
        widget=FilteredSelectMultiple(
            verbose_name="Rodziców",
            is_stacked=False 
        ),
        help_text="Wpisz w wyszukiwarkę imię, nazwisko LUB nazwę grupy (np. 'Pszczółki'), aby przefiltrować listę."
    )

    class Meta:
        model = Message
        fields = '__all__'

# 3. Konfiguracja Admina
class MessageAdmin(admin.ModelAdmin):
    form = MessageAdminForm
    list_display = ('sender', 'receiver', 'subject', 'created_at', 'is_read')
    list_filter = ('is_read', 'created_at')
    search_fields = ('subject', 'sender__username', 'receiver__last_name')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    exclude = ('sender', 'receiver') 

    # Ładowanie plików JS dla widgetu
    class Media:
        css = {
            'all': ('/static/admin/css/widgets.css',),
        }
        js = ('/admin/jsi18n',)

    def save_model(self, request, obj, form, change):
        recipients = form.cleaned_data.get('recipients')
        
        if not recipients:
            messages.warning(request, "Nie wybrano odbiorców.")
            return

        recipient_list = list(recipients)
        
        # Pierwsza wiadomość
        obj.sender = request.user
        obj.receiver = recipient_list[0]
        super().save_model(request, obj, form, change)
        
        # Reszta wiadomości
        count = 1
        for parent in recipient_list[1:]:
            Message.objects.create(
                sender=request.user,
                receiver=parent,
                subject=obj.subject,
                body=obj.body
            )
            count += 1
            
        messages.success(request, f"✅ Wysłano wiadomość do {count} osób.")

admin.site.register(Message, MessageAdmin)