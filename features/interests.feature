Feature: Interest Tracking
  As a user
  I want my taste profile to evolve from my swipes
  So that recommendations get smarter over time

  Background:
    Given the app has seeded users "Partner 1" (id=1) and "Partner 2" (id=2)
    And the interestSignals table tracks dimension, dimensionValue, and signal

  Scenario: Right swipes increase genre affinity
    Given user id=1 swipes right on "The Shining" (id=401)
    And "The Shining" has genreIds [27, 53] (Horror, Thriller)
    When recordSwipeSignal processes the swipe
    Then interestSignals are inserted with signal=1 for:
      | dimension | dimensionValue |
      | genre     | horror         |
      | genre     | thriller       |
    And the user's horror and thriller affinity increases in their taste profile

  Scenario: Left swipes decrease genre affinity
    Given user id=1 swipes left on "The Notebook" (id=402)
    And "The Notebook" has genreIds [18, 10749] (Drama, Romance)
    When recordSwipeSignal processes the swipe
    Then interestSignals are inserted with signal=-1 for:
      | dimension | dimensionValue |
      | genre     | drama          |
      | genre     | romance        |
    And the user's drama and romance affinity decreases in their taste profile

  Scenario: Taste profile includes vibes from LLM tags
    Given user id=1 swipes right on "Blade Runner 2049" (id=403)
    And the movie has llmTags: { vibes: ["dark", "mind-bending"], emotionalTone: ["contemplative"], pacing: "slow" }
    When recordSwipeSignal processes the swipe
    Then interestSignals are inserted for:
      | dimension     | dimensionValue | signal |
      | vibe          | dark           | 1      |
      | vibe          | mind-bending   | 1      |
      | emotionalTone | contemplative  | 1      |
      | pace          | slow           | 1      |
    And the taste profile includes vibes, emotionalTone, and pacing dimensions

  Scenario: Taste profile shows confidence levels
    Given user id=1 has swiped on movies generating 3 signals for "sci-fi"
    And user id=1 has swiped on movies generating 12 signals for "comedy"
    When getUserTasteProfile is called
    Then "sci-fi" has confidence = min(1, 3/10) = 0.3
    And "comedy" has confidence = min(1, 12/10) = 1.0
    And confidence reflects how much data supports each dimension value

  Scenario: Taste profile detects rising trends
    Given user id=1 had signals for "horror" 20 days ago (olderSum = 2)
    And user id=1 has signals for "horror" in the last 14 days (recentSum = 5)
    When computeTrend is called for "horror"
    Then ratio = 5 / |2| = 2.5
    And since ratio > 1.2, trend is "rising"
    And the DimensionScore for horror includes trend: "rising"

  Scenario: Old swipes decay in influence
    Given user id=1 swiped right on a comedy 100 days ago (signal=1)
    And user id=1 swiped right on a comedy 10 days ago (signal=1)
    When applyRecencyDecay is applied
    Then the 100-day-old signal is decayed to 1 * 0.25 = 0.25 (ageDays > 90)
    And the 10-day-old signal remains at 1 * 1.0 = 1.0 (ageDays <= 30)
    And recent swipes have 4x more influence than very old swipes

  Scenario: Taste profile is available after 10+ swipes
    Given user id=1 has swiped on 10 movies with varied genres
    And interestSignals contains entries for multiple dimensions
    When getUserTasteProfile is called
    Then the profile includes sorted DimensionScore arrays for:
      | genres         |
      | vibes          |
      | pacing         |
      | emotionalTone  |
      | eras           |
      | runtimes       |
    And each DimensionScore has value, affinity, confidence, and trend
    And arrays are sorted by affinity descending

  Scenario: Era preferences are tracked from release dates
    Given user id=1 swipes right on "Pulp Fiction" (id=404, releaseDate: "1994-10-14")
    When recordSwipeSignal processes the swipe
    And getDecadeBucket extracts "1990s" from the release date
    Then an interestSignal is inserted with dimension="era", dimensionValue="1990s", signal=1
    And the user's taste profile shows affinity for 1990s films

  Scenario: LLM-enriched movies provide richer signals
    Given "Everything Everywhere All at Once" (id=405) has been enriched by LLM
    And llmTags contains: { vibes: ["mind-bending", "feel-good"], emotionalTone: ["hopeful", "chaotic"], pacing: "fast" }
    When user id=1 swipes right on this movie
    Then signals are recorded for all dimensions present in llmTags
    And the user's profile captures nuanced preferences beyond just genres
