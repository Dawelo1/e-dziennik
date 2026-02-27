from channels.routing import URLRouter

from communication.routing import websocket_urlpatterns
from communication.ws_auth import TokenAuthMiddlewareStack


websocket_application = TokenAuthMiddlewareStack(
    URLRouter(websocket_urlpatterns)
)
