# src/server/connection_manager.py
import logging
import asyncio
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logging.warning(f"[WS] send_personal_message failed: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return

        async def send_to_connection(connection: WebSocket):
            try:
                # Use wait_for to ensure a slow/dead client doesn't block the server
                await asyncio.wait_for(connection.send_json(message), timeout=2.0)
                return None
            except Exception as e:
                logging.warning(f"[WS] broadcast send failed: {e}")
                return connection

        # Run all sends concurrently
        results = await asyncio.gather(
            *(send_to_connection(c) for c in self.active_connections),
            return_exceptions=True
        )
        
        # Clean up any failed or timed-out connections
        for res in results:
            if isinstance(res, WebSocket):
                self.disconnect(res)

manager = ConnectionManager()