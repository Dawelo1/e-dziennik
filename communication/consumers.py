from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Message


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.user = user
        self.user_group_name = f'user_{self.user.id}'

        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

        unread_count = await self.get_unread_count()
        await self.send_json({
            'type': 'unread_count',
            'count': unread_count,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get('type')
        if event_type == 'ping':
            await self.send_json({'type': 'pong'})

    async def chat_message(self, event):
        await self.send_json({
            'type': 'new_message',
            'message': event.get('message', {}),
        })

    async def chat_conversation_read(self, event):
        await self.send_json({
            'type': 'conversation_read',
            'reader_id': event.get('reader_id'),
            'participant_id': event.get('participant_id'),
            'read_message_ids': event.get('read_message_ids', []),
        })

    async def chat_unread_count(self, event):
        await self.send_json({
            'type': 'unread_count',
            'count': event.get('count', 0),
        })

    async def chat_error(self, event):
        await self.send_json({
            'type': 'error',
            'message': event.get('message', 'unknown error'),
        })

    async def get_unread_count(self):
        return await Message.objects.filter(receiver=self.user, is_read=False).acount()
