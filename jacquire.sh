#!/bin/bash
gnome-terminal -- bash -c "python3 -m src.server.main; exec bash"
gnome-terminal -- bash -c "pnpm run dev; exec bash"
