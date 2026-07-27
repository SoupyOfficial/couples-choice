Feature: Personalized Movie Ranking
  As a user
  I want movies ranked by my preferences
  So that the best suggestions appear first

  Background:
    Given the app has seeded users "Partner 1" (id=1) and "Partner 2" (id=2)
    And the ranking system uses DEFAULT_WEIGHTS:
      | bayesianRating:  0.20 |
      | popularity:      0.15 |
      | genreAffinity:   0.25 |
      | vibeAffinity:    0.15 |
      | partnerLikelihood: 0.15 |
      | recencyDecay:    0.05 |
      | diversityBonus:  0.05 |

  Scenario: Movies matching genre preferences rank higher
    Given user id=1 has interestSignals showing high affinity for "sci-fi" (affinity: 0.8, confidence: 0.9)
    And candidate movies include:
      | id | title           | genreIds       |
      | 301 | Inception       | [878, 28, 53]  |
      | 302 | The Notebook    | [18, 10749]    |
    When rankCandidates is called for user id=1
    Then "Inception" receives a higher genreAffinity score than "The Notebook"
    And "Inception" ranks above "The Notebook" in the final sorted list

  Scenario: Movies matching vibe preferences rank higher
    Given user id=1 has interestSignals for vibe "mind-bending" (affinity: 0.85)
    And candidate movies include:
      | id | title           | llmTags.vibes                  |
      | 303 | Tenet           | ["mind-bending", "intense"]   |
      | 304 | Paddington 2    | ["feel-good", "cozy"]         |
    When rankCandidates is called for user id=1
    Then "Tenet" receives a higher vibeAffinity score
    And "Tenet" ranks above "Paddington 2"

  Scenario: Movies partner already liked rank higher
    Given user id=2 has right-swiped on "Eternal Sunshine" (id=305)
    And user id=1 is fetching their next movie
    When partnerLikelihood is calculated for "Eternal Sunshine"
    Then partnerRightSwipedIds contains 305
    And partnerLikelihood returns 1.0 (maximum score)
    And "Eternal Sunshine" gets a significant ranking boost

  Scenario: Recently shown movies are deprioritized
    Given user id=1's last 10 swipes include "The Matrix" (id=306) at position 2
    And "The Matrix" is still in the candidate pool
    When recencyScore is calculated for "The Matrix"
    Then recencyScore returns 0.2 + (0.7 * (9 - 2)) / 9 = 0.74
    And "The Matrix" receives a lower recencyDecay component score
    And movies not recently shown receive recencyScore of 1.0

  Scenario: Genre diversity is enforced (not all same genre)
    Given user id=1's recently shown genres are ["sci-fi", "sci-fi", "sci-fi", "action"]
    And candidate movies include:
      | id | title          | genreIds      |
      | 307 | Blade Runner   | [878, 18]     |
      | 308 | When Harry Met Sally | [35, 10749] |
    When diversityScore is calculated
    Then "Blade Runner" gets a lower diversityScore (overlap > 2 → 0.5)
    And "When Harry Met Sally" gets diversityScore of 1.0 (no overlap)
    And the diversity bonus helps surface different genres

  Scenario: Cold start ranking works without profile data
    Given user id=1 has fewer than 5 interestSignals (isColdStart = true)
    And candidate movies include:
      | id | title      | popularity | voteAverage | voteCount |
      | 309 | Avatar     | 850        | 7.9         | 25000     |
      | 310 | A24 Indie  | 45         | 7.2         | 800       |
    When rankCandidates is called
    Then coldStartScore is used instead of full weighted scoring
    And coldStartScore = clamp(0.6 * popularityNorm + 0.4 * bayesianRating)
    And "Avatar" ranks higher due to its popularity of 850 (normalized near 1.0)

  Scenario: Ranking improves as user swipes more
    Given user id=1 starts with 0 interestSignals (cold start)
    When user id=1 swipes right on 5 sci-fi movies
    Then 5 sets of interestSignals are recorded (genre, vibes, era, etc.)
    And getUserTasteProfile returns a profile with totalSignals >= 5
    And isColdStart becomes false
    When the next rankCandidates call is made
    Then full weighted scoring is used with genreAffinity and vibeAffinity
    And sci-fi movies now rank higher for this user

  Scenario: Partner swipe history affects ranking even without partner profile
    Given user id=2 has swiped on movies but has no interestSignals
    And user id=1 is fetching movies
    When partnerLikelihood is calculated
    Then partnerProfile is null (no signals)
    But partnerRightSwipedIds still contains user id=2's right swipes
    And movies in partnerRightSwipedIds get partnerLikelihood of 1.0
    And movies the partner left-swiped get partnerLikelihood of 0.0

  Scenario: Bayesian rating prevents low-vote movies from ranking too high
    Given candidate movies include:
      | id | title             | voteAverage | voteCount |
      | 311 | Classic Masterpiece | 9.0      | 50000     |
      | 312 | Obscure Short     | 10.0      | 3         |
    When bayesianRating is calculated (BAYESIAN_C=7.0, BAYESIAN_M=200)
    Then "Classic Masterpiece" bayesianRating ≈ (9.0*50000 + 7.0*200) / (50000+200) ≈ 8.97
    And "Obscure Short" bayesianRating ≈ (10.0*3 + 7.0*200) / (3+200) ≈ 7.07
    And the classic ranks higher despite the short's perfect 10.0 rating
