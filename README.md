# Julianne's Garcia Family

A private, family-first digital archive for preserving the Garcia family's photos, videos, voices, and stories.

## Product idea

This project is not a generic file drive. Its core object is a **Memory**: a family story that can contain photos, video, written narration, people, dates, places, and—later—recorded voice narration.

The experience should feel like a granddaughter learning where her family came from while helping preserve that history for the next generation.

## Design principles

- **Media first:** photos and videos are the primary way family members explore the archive.
- **Story over filename:** `IMG_4829.jpg` should become “Grandma's Graduation — California, 1976.”
- **Private by default:** family content is never intended for search-engine indexing or anonymous browsing.
- **Originals are protected:** archival scans and original videos are mounted read-only in production.
- **Family contribution is easy:** relatives can add media and tell the story behind it.
- **Human history matters:** people, dates, places, relationships, and narration are first-class data.
- **Production isolation:** the site runs in its own Docker stack and does not depend on other services on the host.

## Planned experiences

- Home / featured memories
- Memory gallery
- Memory detail pages
- Photo and video upload
- Written family stories
- People tags
- Timeline
- Places
- Albums
- Family accounts
- Curator/admin approval
- Voice narration
- Downloadable originals with permission controls

## Production target

The application is designed for a private home-hosted Docker deployment with:

- Next.js web application
- PostgreSQL metadata database
- FFmpeg for media processing
- Local/NAS-backed media storage
- HTTPS remote access added separately

## Important

Family photos, videos, database files, passwords, backups, and production `.env` files must never be committed to this repository.
