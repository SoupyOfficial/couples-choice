Feature: Diverse User Personas
  As a product owner
  I want the app tested with diverse couple archetypes
  So that it works for all kinds of users

  Background:
    Given the app supports two users (id=1 and id=2) sharing a device
    And the ranking system adapts to each user's swipe history

  Scenario: Classic couple finds golden-age films
    Given Partner 1 describes: "We love classic Hollywood — Casablanca, Citizen Kane, Gone with the Wind. Black and white is fine. Nothing after 1980."
    And Partner 2 describes: "Golden era films, musicals from the 50s, and film noir. Modern blockbusters bore us."
    When both users complete onboarding and start swiping
    Then their extractedPrefs include yearRange with max around 1980
    And their interestSignals favor genres like "drama", "romance", "music"
    And movies like "Casablanca", "Singin' in the Rain", and "The Third Man" rank highly
    And recent Marvel or Fast & Furious movies rank low due to year and genre mismatch

  Scenario: Anime twins find Studio Ghibli matches
    Given Partner 1 describes: "We're obsessed with anime films — Studio Ghibli, Makoto Shinkai, Satoshi Kon. Spirited Away and Your Name are our favorites."
    And Partner 2 describes: "Japanese animation, especially Ghibli. Also love Korean animated films like Yeonpil-so."
    When both users complete onboarding and start swiping
    Then their extractedPrefs include languages: ["ja", "ko"]
    And their interestSignals favor "animation" genre and vibes like "whimsical", "emotional"
    And movies like "Spirited Away", "Your Name", and "Perfect Blue" rank highly
    And live-action Hollywood comedies rank lower

  Scenario: Sci-fi + drama couple finds crossover films like Arrival
    Given Partner 1 describes: "Hard sci-fi only — Interstellar, The Martian, Ex Machina. Love thinking about big ideas."
    And Partner 2 describes: "Character-driven dramas with emotional depth — The Shawshank Redemption, Manchester by the Sea."
    When both users complete onboarding and start swiping
    Then Partner 1's interestSignals favor "sci-fi" and vibes like "mind-bending"
    And Partner 2's interestSignals favor "drama" and vibes like "emotional", "contemplative"
    And crossover films like "Arrival" (sci-fi + drama + emotional) rank highly for both
    And pure comedies or horror films rank low for both users

  Scenario: Horror junkies don't see rom-coms
    Given Partner 1 describes: "Horror is our date night — Hereditary, The Conjuring, Get Out. The scarier the better."
    And Partner 2 describes: "We love psychological thrillers and supernatural horror. No rom-coms or family films."
    When both users complete onboarding and start swiping
    Then their extractedPrefs include avoidThemes with "romance", "family-friendly"
    And their interestSignals heavily favor "horror" and "thriller" genres
    And movies like "Hereditary", "The Babadook", and "Talk to Me" rank highly
    And "The Notebook", "Paddington 2", and "Frozen" rank at the bottom

  Scenario: Weekend warriors get fast-paced under-2-hour films
    Given Partner 1 describes: "We only have Friday nights — want something fun and quick. Action comedies, heist movies, under 2 hours."
    And Partner 2 describes: "Fast-paced stuff we can enjoy with beers. Ocean's Eleven, Baby Driver, Knives Out type energy."
    When both users complete onboarding and start swiping
    Then their extractedPrefs include runtimePref: "under-90" or "90-120"
    And their interestSignals favor "action", "comedy", "crime" genres
    And vibes like "fast-paced", "fun", "energetic" are prominent
    And 3-hour epics like "Oppenheimer" or slow art films rank lower
    And movies under 120 minutes with high pacing rank higher

  Scenario: Arthouse pair gets indie and foreign films
    Given Partner 1 describes: "A24, Criterion Collection, foreign language films. Parasite, Moonlight, The Zone of Interest."
    And Partner 2 describes: "We go to film festivals. Love indie directors — Greta Gerwig, Bong Joon-ho, Celine Sciamma."
    When both users complete onboarding and start swiping
    Then their extractedPrefs include diverse languages and avoid mainstream blockbusters
    And their interestSignals favor "drama", with vibes like "thought-provoking", "artistic"
    And films from A24, Neon, and international distributors rank highly
    And Marvel, DC, and franchise sequels rank lower despite high popularity

  Scenario: Couple with opposite tastes finds middle ground
    Given Partner 1 describes: "Big budget action — Marvel, DC, Fast & Furious. Popcorn entertainment."
    And Partner 2 describes: "Quiet indie dramas and documentaries. Nothing with explosions."
    When both users complete onboarding and start swiping
    Then Partner 1's interestSignals favor "action", "sci-fi", "fantasy"
    And Partner 2's interestSignals favor "drama", "documentary", vibes like "quiet", "intimate"
    And the partnerLikelihood ranking factor boosts movies that appeal to both profiles
    And crossover films like "Everything Everywhere All at Once" (action + drama + indie sensibility) rank well
    And pure Marvel blockbusters and pure slow documentaries both rank lower
    And the ranking system finds the compromise zone between their tastes

  Scenario: Persona preferences improve over time through swiping
    Given any couple archetype has completed onboarding
    When they swipe on 20+ movies consistently in their taste area
    Then their taste profile confidence reaches 1.0 (10+ signals per dimension)
    And the ranking shifts from coldStartScore to full weighted scoring
    And the recommendations become increasingly tailored to their archetype
    And the "❤️ They liked this!" indicator helps the hesitant partner discover matches
