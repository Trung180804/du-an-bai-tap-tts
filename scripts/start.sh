#!/bin/bash
cd /home/ubuntu/du-an-bai-tap-tts
pm2 restart nest-backend || pm2 start dist/main.js --name nest-backend
pm2 save