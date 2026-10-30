#!/bin/sh
set -e

# Render tells the app which port to use.
PORT="${PORT:-10000}"
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

php artisan package:discover --ansi
php artisan migrate --force
php artisan raincheck:install-data

exec apache2-foreground
