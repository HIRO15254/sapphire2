# Specification Quality Checklist: 店舗・通貨・ゲーム設定マスターデータ管理

**Purpose**: Validate the spec against the current implementation
**Created**: 2026-03-19
**Updated**: 2026-04-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Focuses on the current product behavior
- [x] Avoids claiming features that are not implemented
- [x] Uses current route and router names
- [x] Keeps terminology consistent across files

## Requirement Completeness

- [x] Store, currency, and settings flows are covered
- [x] Cash Game and Tournament flows are separated clearly
- [x] Tournament child data is represented explicitly
- [x] Archiving and restoration are documented
- [x] Ownership and deletion constraints are documented

## Feature Readiness

- [x] `/stores`, `/currencies`, and `/settings` are reflected in the docs
- [x] Store detail tabs match the current UI
- [x] API contracts match the registered routers
- [x] Data model matches the current schema

## Notes

- The spec is synchronized to the current codebase as of 2026-04-08.
