// Premier League 5-in-a-Row Analyzer

const SEASONS = [
    "2025-26", "2024-25", "2023-24", "2022-23", "2021-22", "2020-21",
    "2019-20", "2018-19", "2017-18", "2016-17", "2015-16",
    "2014-15", "2013-14", "2012-13", "2011-12", "2010-11",
    "2009-10", "2008-09", "2007-08", "2006-07", "2005-06"
];

let currentData = null;
let seasonMetadata = {};
let allSeasonsData = {};
let allTeamsStreaks = {};
let currentView = 'season';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllSeasons();
    buildTeamStreaksIndex();
    renderSeasonList();
    renderTeamList();
    setupViewToggle();

    // Load most recent season by default
    loadSeason(SEASONS[0]);
});

// Load all seasons data
async function loadAllSeasons() {
    const promises = SEASONS.map(async (season) => {
        try {
            const response = await fetch(`data/${season}.json`);
            if (!response.ok) return null;
            const data = await response.json();
            allSeasonsData[season] = data;

            let totalStreaks = 0;
            for (const team in data.results) {
                totalStreaks += countStreaks(data.results[team]);
            }
            seasonMetadata[season] = { streaks: totalStreaks };

            return data;
        } catch {
            return null;
        }
    });

    await Promise.all(promises);
}

// Build index of all streaks by team across all seasons
function buildTeamStreaksIndex() {
    allTeamsStreaks = {};

    for (const season of SEASONS) {
        const data = allSeasonsData[season];
        if (!data) continue;

        for (const team of data.teams) {
            if (!allTeamsStreaks[team]) {
                allTeamsStreaks[team] = [];
            }

            const results = data.results[team] || [];
            const matches = data.matches?.[team] || [];
            const streaks = findStreakRanges(results);

            for (const streak of streaks) {
                const streakMatches = [];
                for (let i = streak.start; i <= streak.end; i++) {
                    if (matches[i]) {
                        streakMatches.push({
                            matchweek: i + 1,
                            opponent: matches[i].opponent,
                            venue: matches[i].venue,
                            score: matches[i].score,
                            displayScore: formatDisplayScore(matches[i].score, matches[i].venue)
                        });
                    }
                }

                allTeamsStreaks[team].push({
                    season,
                    startWeek: streak.start + 1,
                    endWeek: streak.end + 1,
                    length: streak.length,
                    matches: streakMatches
                });
            }
        }
    }

    // Sort each team's streaks by season (most recent first), then by length
    for (const team in allTeamsStreaks) {
        allTeamsStreaks[team].sort((a, b) => {
            const seasonDiff = SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season);
            if (seasonDiff !== 0) return seasonDiff;
            return b.length - a.length;
        });
    }
}

// Find streak ranges (start, end, length) for 5+ win streaks
function findStreakRanges(results) {
    const streaks = [];
    let streakStart = -1;
    let streakLength = 0;

    for (let i = 0; i <= results.length; i++) {
        if (results[i] === 'W') {
            if (streakStart === -1) streakStart = i;
            streakLength++;
        } else {
            if (streakLength >= 5) {
                streaks.push({
                    start: streakStart,
                    end: streakStart + streakLength - 1,
                    length: streakLength
                });
            }
            streakStart = -1;
            streakLength = 0;
        }
    }

    return streaks;
}

// Format score for display (home team first)
function formatDisplayScore(score, venue) {
    if (!score) return '';
    const [goalsFor, goalsAgainst] = score.split('-');
    if (venue === 'H') {
        // We're home, our goals first (already correct)
        return score;
    } else {
        // We're away, opponent (home) goals first
        return `${goalsAgainst}-${goalsFor}`;
    }
}

// Count number of 5+ win streaks
function countStreaks(results) {
    let count = 0;
    let streak = 0;

    for (const r of results) {
        if (r === 'W') {
            streak++;
        } else {
            if (streak >= 5) count++;
            streak = 0;
        }
    }
    if (streak >= 5) count++;

    return count;
}

// Setup view toggle buttons
function setupViewToggle() {
    document.getElementById('view-season').addEventListener('click', () => switchView('season'));
    document.getElementById('view-team').addEventListener('click', () => switchView('team'));
}

function switchView(view) {
    currentView = view;

    document.getElementById('view-season').classList.toggle('active', view === 'season');
    document.getElementById('view-team').classList.toggle('active', view === 'team');

    document.getElementById('season-nav').style.display = view === 'season' ? 'block' : 'none';
    document.getElementById('team-nav').style.display = view === 'team' ? 'block' : 'none';

    document.getElementById('season-view').style.display = view === 'season' ? 'block' : 'none';
    document.getElementById('team-view').style.display = view === 'team' ? 'block' : 'none';

    if (view === 'team') {
        // Load team with most streaks by default if none selected
        const teams = Object.keys(allTeamsStreaks).sort((a, b) => {
            const countDiff = (allTeamsStreaks[b]?.length || 0) - (allTeamsStreaks[a]?.length || 0);
            if (countDiff !== 0) return countDiff;
            return a.localeCompare(b);
        });
        if (teams.length > 0) {
            const activeTeam = document.querySelector('#team-list li.active');
            if (!activeTeam) {
                loadTeamStreaks(teams[0]);
            }
        }
    }
}

// Render the season list in sidebar
function renderSeasonList() {
    const list = document.getElementById('season-list');
    list.innerHTML = '';

    SEASONS.forEach(season => {
        const li = document.createElement('li');
        const streakCount = seasonMetadata[season]?.streaks || 0;

        let badgeClass = '';
        if (streakCount === 0) badgeClass = 'zero';
        else if (streakCount < 5) badgeClass = 'low';

        li.innerHTML = `
            <span class="season-name">${season}</span>
            <span class="streak-count ${badgeClass}">${streakCount}</span>
        `;

        li.addEventListener('click', () => loadSeason(season));
        list.appendChild(li);
    });
}

// Render the team list in sidebar
function renderTeamList() {
    const list = document.getElementById('team-list');
    list.innerHTML = '';

    // Sort teams by number of streaks (descending), then alphabetically
    const teams = Object.keys(allTeamsStreaks).sort((a, b) => {
        const countDiff = (allTeamsStreaks[b]?.length || 0) - (allTeamsStreaks[a]?.length || 0);
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b);
    });

    teams.forEach(team => {
        const li = document.createElement('li');
        const streakCount = allTeamsStreaks[team]?.length || 0;

        let badgeClass = '';
        if (streakCount === 0) badgeClass = 'zero';
        else if (streakCount < 3) badgeClass = 'low';

        li.innerHTML = `
            <span class="season-name">${team}</span>
            <span class="streak-count ${badgeClass}">${streakCount}</span>
        `;

        li.addEventListener('click', () => loadTeamStreaks(team));
        list.appendChild(li);
    });
}

// Load season data
async function loadSeason(season) {
    // Update active state in sidebar
    document.querySelectorAll('#season-list li').forEach((li, idx) => {
        li.classList.toggle('active', SEASONS[idx] === season);
    });

    const data = allSeasonsData[season];
    if (!data) {
        showError(`Could not load data for ${season} season.`);
        return;
    }

    currentData = data;
    const streakCount = seasonMetadata[season]?.streaks || 0;
    document.getElementById('season-subtitle').textContent =
        `${season} Season - ${streakCount} five-game win streak${streakCount !== 1 ? 's' : ''}`;

    renderTable(data);
}

// Load team streaks view
function loadTeamStreaks(team) {
    // Update active state in sidebar (sorted by streak count)
    const teams = Object.keys(allTeamsStreaks).sort((a, b) => {
        const countDiff = (allTeamsStreaks[b]?.length || 0) - (allTeamsStreaks[a]?.length || 0);
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b);
    });
    document.querySelectorAll('#team-list li').forEach((li, idx) => {
        li.classList.toggle('active', teams[idx] === team);
    });

    const streaks = allTeamsStreaks[team] || [];
    const totalWins = streaks.reduce((sum, s) => sum + s.length, 0);

    document.getElementById('season-subtitle').textContent =
        `${team} - ${streaks.length} streak${streaks.length !== 1 ? 's' : ''} (${totalWins} wins in streaks)`;

    renderTeamStreaks(team, streaks);
}

// Build season frequency data for bar chart
function buildSeasonFrequency(streaks) {
    const freq = {};
    // Initialize all seasons with 0
    for (const season of SEASONS) {
        freq[season] = 0;
    }
    // Count streaks per season
    for (const streak of streaks) {
        freq[streak.season] = (freq[streak.season] || 0) + 1;
    }
    return freq;
}

// Render team streaks
function renderTeamStreaks(team, streaks) {
    const container = document.getElementById('team-streaks-container');

    if (streaks.length === 0) {
        container.innerHTML = `<div class="no-streaks">No 5+ game win streaks found for ${team}</div>`;
        return;
    }

    const freq = buildSeasonFrequency(streaks);
    const maxFreq = Math.max(...Object.values(freq), 1);
    const barMaxHeight = 70; // pixels

    let html = `
        <div class="team-streaks-header">
            <h2>${team}</h2>
            <div class="stats">${streaks.length} streak${streaks.length !== 1 ? 's' : ''} across ${new Set(streaks.map(s => s.season)).size} season${new Set(streaks.map(s => s.season)).size !== 1 ? 's' : ''}</div>
        </div>
        <div class="streak-chart">
            <div class="chart-bars">
    `;

    // Render bars in chronological order (oldest first)
    const seasonsChronological = [...SEASONS].reverse();
    for (const season of seasonsChronological) {
        const count = freq[season] || 0;
        const heightPx = count > 0 ? Math.max((count / maxFreq) * barMaxHeight, 8) : 4;
        const shortSeason = season.split('-')[0].slice(-2);
        html += `
            <div class="chart-bar-container">
                <div class="chart-bar ${count > 0 ? 'has-streak' : ''}" style="height: ${heightPx}px;" title="${season}: ${count} streak${count !== 1 ? 's' : ''}">
                    ${count > 0 ? `<span class="bar-value">${count}</span>` : ''}
                </div>
                <div class="chart-label">${shortSeason}</div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    for (const streak of streaks) {
        html += `
            <div class="streak-card">
                <div class="streak-card-header">
                    <span class="streak-season">${streak.season} (MW ${streak.startWeek}-${streak.endWeek})</span>
                    <span class="streak-length">${streak.length} wins</span>
                </div>
                <div class="streak-matches">
        `;

        for (const match of streak.matches) {
            html += `
                <div class="streak-match">
                    <span class="opponent">${match.venue === 'H' ? 'vs' : '@'} ${getShortName(match.opponent)}</span>
                    <span class="score">${match.displayScore}</span>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Get short team name for display
function getShortName(name) {
    const shorts = {
        'Manchester United': 'Man Utd',
        'Manchester City': 'Man City',
        'Tottenham Hotspur': 'Spurs',
        'Wolverhampton': 'Wolves',
        'Brighton & Hove Albion': 'Brighton',
        'West Ham United': 'West Ham',
        'Newcastle United': 'Newcastle',
        'Nottingham Forest': 'Forest',
        'Sheffield United': 'Sheff Utd',
        'Sheffield Wednesday': 'Sheff Wed',
        'West Bromwich Albion': 'West Brom',
        'AFC Bournemouth': 'Bournemouth',
        'Queens Park Rangers': 'QPR',
        'Huddersfield Town': 'Huddersfield',
        'Leicester City': 'Leicester',
        'Norwich City': 'Norwich',
        'Swansea City': 'Swansea',
        'Cardiff City': 'Cardiff',
        'Stoke City': 'Stoke',
        'Hull City': 'Hull',
        'Ipswich Town': 'Ipswich',
        'Luton Town': 'Luton',
        'Birmingham City': 'Birmingham',
        'Blackburn Rovers': 'Blackburn',
        'Bolton Wanderers': 'Bolton',
        'Wigan Athletic': 'Wigan',
        'Charlton Athletic': 'Charlton',
        'Leeds United': 'Leeds',
    };
    return shorts[name] || name;
}

// Calculate league standings from results
function calculateStandings(data) {
    const standings = [];

    for (const team of data.teams) {
        const results = data.results[team] || [];
        const matches = data.matches?.[team] || [];

        let wins = 0, draws = 0, losses = 0;
        let goalsFor = 0, goalsAgainst = 0;

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const match = matches[i];

            if (result === 'W') wins++;
            else if (result === 'D') draws++;
            else if (result === 'L') losses++;

            if (match?.score) {
                const [gf, ga] = match.score.split('-').map(Number);
                goalsFor += gf;
                goalsAgainst += ga;
            }
        }

        const points = wins * 3 + draws;
        const goalDiff = goalsFor - goalsAgainst;

        standings.push({
            team,
            played: results.length,
            wins,
            draws,
            losses,
            goalsFor,
            goalsAgainst,
            goalDiff,
            points
        });
    }

    // Sort by points (desc), then goal difference (desc), then goals scored (desc)
    standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
    });

    return standings;
}

// Render the results table
function renderTable(data) {
    const headerRow = document.getElementById('header-row');
    const tbody = document.getElementById('results-body');

    // Clear existing content
    headerRow.innerHTML = '<th class="team-header">#</th><th class="team-name-header">Team</th>';
    tbody.innerHTML = '';

    // Determine number of matchweeks from data
    const maxMatchweeks = Math.max(
        ...Object.values(data.results).map(r => r.length)
    );

    // Create header cells for each matchweek
    for (let i = 1; i <= maxMatchweeks; i++) {
        const th = document.createElement('th');
        th.className = 'matchweek-header';
        th.textContent = i;
        headerRow.appendChild(th);
    }

    // Calculate standings and sort by league position
    const standings = calculateStandings(data);
    const sortedTeams = standings.map(s => s.team);

    // Create rows for each team
    sortedTeams.forEach((team, idx) => {
        const row = document.createElement('tr');
        const position = idx + 1;
        const teamStanding = standings[idx];

        // Position cell
        const posCell = document.createElement('td');
        posCell.className = 'position-cell';
        posCell.textContent = position;
        row.appendChild(posCell);

        // Team name cell with points
        const teamCell = document.createElement('td');
        teamCell.className = 'team-cell';
        teamCell.innerHTML = `${team} <span class="team-points">${teamStanding.points}pts</span>`;
        row.appendChild(teamCell);

        // Get results and detect streaks
        const results = data.results[team] || [];
        const matches = data.matches?.[team] || [];
        const streaks = detectStreaks(results);

        // Create result cells
        for (let i = 0; i < maxMatchweeks; i++) {
            const cell = document.createElement('td');
            const result = results[i] || '';
            const match = matches[i];

            cell.className = 'result-cell';

            if (result && match) {
                // Show score instead of W/D/L
                const displayScore = formatDisplayScore(match.score, match.venue);
                cell.textContent = displayScore;
                cell.classList.add(`result-${result}`);

                // Apply streak highlighting
                if (streaks[i]) {
                    cell.classList.add('streak');
                    if (streaks[i].start) cell.classList.add('streak-start');
                    if (streaks[i].end) cell.classList.add('streak-end');
                }

                // Add tooltip data
                cell.dataset.opponent = match.opponent;
                cell.dataset.venue = match.venue;
                cell.dataset.score = displayScore;
                cell.dataset.result = result;

                cell.addEventListener('mouseenter', showTooltip);
                cell.addEventListener('mouseleave', hideTooltip);
                cell.addEventListener('mousemove', moveTooltip);
            } else if (result) {
                cell.textContent = result;
                cell.classList.add(`result-${result}`);
            } else {
                cell.textContent = '-';
                cell.classList.add('result-empty');
            }

            row.appendChild(cell);
        }

        tbody.appendChild(row);
    });
}

// Detect 5+ consecutive win streaks
function detectStreaks(results) {
    const streaks = {};
    let streakStart = -1;
    let streakLength = 0;

    for (let i = 0; i <= results.length; i++) {
        const result = results[i];

        if (result === 'W') {
            if (streakStart === -1) {
                streakStart = i;
            }
            streakLength++;
        } else {
            // Streak ended or never started
            if (streakLength >= 5) {
                // Mark all cells in this streak
                for (let j = streakStart; j < streakStart + streakLength; j++) {
                    streaks[j] = {
                        start: j === streakStart,
                        end: j === streakStart + streakLength - 1
                    };
                }
            }
            streakStart = -1;
            streakLength = 0;
        }
    }

    return streaks;
}

// Tooltip functions
const tooltip = document.getElementById('tooltip');

function showTooltip(e) {
    const cell = e.target;
    const opponent = cell.dataset.opponent;
    const venue = cell.dataset.venue;
    const score = cell.dataset.score;
    const result = cell.dataset.result;

    const venueText = venue === 'H' ? '(Home)' : '(Away)';
    const resultClass = result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw';

    tooltip.innerHTML = `
        <div class="opponent">${venue === 'H' ? 'vs' : '@'} ${opponent}</div>
        <div class="venue">${venueText}</div>
        <div class="score ${resultClass}">${score}</div>
    `;

    tooltip.classList.add('visible');
    moveTooltip(e);
}

function hideTooltip() {
    tooltip.classList.remove('visible');
}

function moveTooltip(e) {
    const x = e.clientX + 15;
    const y = e.clientY + 15;

    // Keep tooltip on screen
    const rect = tooltip.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;

    tooltip.style.left = Math.min(x, maxX) + 'px';
    tooltip.style.top = Math.min(y, maxY) + 'px';
}

// Show error message
function showError(message) {
    const tbody = document.getElementById('results-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="39" style="text-align: center; padding: 2rem; color: #e74c3c;">
                ${message}
            </td>
        </tr>
    `;
    document.getElementById('season-subtitle').textContent = 'Error loading data';
}
