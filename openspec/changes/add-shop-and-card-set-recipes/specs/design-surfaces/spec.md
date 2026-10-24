## ADDED Requirements

### Requirement: Shop and Card Surfaces
The surface catalog SHALL include a ready `shop` surface whose entries include `shop-pack`, and a ready `cards` surface whose entries include `card-set`, each with questions that ask what the user sells or makes, where they sell or print, and what material they already have.

#### Scenario: Cards surface
- **WHEN** the agent calls `list_open_design_skills` with `surface: "cards"`
- **THEN** the result SHALL list `card-set` and the surface's questions

### Requirement: Seller Goals
The goal catalog SHALL include `sell-online` leading to `shop`, `social`, `email` and `campaign`, and `make-cards` leading to `cards` and `social`, in that order.

#### Scenario: Make cards goal
- **WHEN** the agent calls `list_open_design_skills` with `goal: "make-cards"`
- **THEN** the result SHALL list `cards` then `social`, with `cards` marked as the default
