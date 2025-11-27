const SUPABASE_URL = 'https://lkhcemzurtyyaqctdedb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraGNlbXp1cnR5eWFxY3RkZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcwMjgsImV4cCI6MjA3NzM5MzAyOH0.-BjUQu7NhRPQGKEyeDHowiWeU2cDgdUqlOeNmdy5Rgc';
const ADMIN_PASSWORD = 'admin123';

const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentSession = null;
let adminLoggedIn = false;
let currentGame = null;
let currentGameSet = [];
let currentGameIndex = 0;
let activityChart = null;
let gamesChart = null;
let sessionStartTime = null;
let questionsAnswered = 0;
let sessionValid = false;
let sessionInProgress = false;
const SESSION_WORD_LIMIT = 15;
let sessionMode = 'all';
let allVocabulary = [];
let practiceType = 'vocabulary'; // 'vocabulary' ou 'conjugation'

// ========== NAVIGATION (NOUVEAU) ==========
function switchTab(tabId) {
    // Masquer tous les contenus d'onglets
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Afficher le contenu de l'onglet sélectionné
    const tabToShow = document.getElementById(tabId);
    if (tabToShow) {
        tabToShow.style.display = 'block';
    }

    // Gérer l'état actif des boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Action spécifique à l'onglet
    if (tabId === 'admin' && adminLoggedIn) {
        loadAdminData();
    } else if (tabId === 'account' && currentUser) {
        loadUserStats();
    }
}

// ========== BIND EVENT LISTENERS (NOUVEAU) ========== 
function bindEventListeners() {
    // Header
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Game Setup
    document.getElementById('gameCategory').addEventListener('change', updateModeCounts);
    document.querySelectorAll('.mode-option input[name="sessionMode"]').forEach(radio => {
        radio.addEventListener('click', () => selectMode(radio.value));
    });
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => startGame(card.dataset.game));
    });

    // Vocab Tab
    document.getElementById('addWordsBtn').addEventListener('click', addWords);
    document.getElementById('filterCategory').addEventListener('change', displayVocab);

    // Account Tab
    document.getElementById('loginBtn').addEventListener('click', loginUser);
    document.getElementById('registerBtn').addEventListener('click', registerUser);
    document.getElementById('logoutBtn').addEventListener('click', logoutUser);

    // Admin Tab
    document.getElementById('loginAdminBtn').addEventListener('click', loginAdmin);
    document.getElementById('exportJsonBtn').addEventListener('click', exportAdminData);
    document.getElementById('exportStatsBtn').addEventListener('click', exportStatsReport);
    document.getElementById('cleanInactiveBtn').addEventListener('click', cleanInactiveUsers);
    document.getElementById('logoutAdminBtn').addEventListener('click', logoutAdmin);
    document.getElementById('adminCategoryFilter').addEventListener('change', filterVocabByCategory);

    // Game specific event listeners (for dynamic content)
    // These will need to be re-bound when game content changes
    // For writing game, keypress on input
    document.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && document.getElementById('writingInput')) {
            checkWritingAnswer();
        }
    });
}

// ========== INITIALIZATION ========== 
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    const btn = document.getElementById('darkModeToggle');
    btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
}

function loadDarkMode() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️';
    }
}

async function init() {
    bindEventListeners(); // ← LIGNE AJOUTÉE
    loadDarkMode();
    switchTab('jeux'); // Afficher l'onglet par défaut
    await checkUserSession();
    await displayVocab();
    await updateWordCounter();
    await updateModeCounts();
    updateCategoryFilter(); // Initialiser le filtre de catégorie
    subscribeToChanges();
}

// CRITIQUE : Lancer init() au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Application Vocabulaire Coréen démarrée');
    init();
});

async function updateWordCounter() {
    const { data, error } = await client.from('vocabulary').select('id', { count: 'exact' });
    if (!error && data) {
        document.getElementById('totalWordCount').innerText = data.length;
    }
}

function subscribeToChanges() {
    client.channel('vocabulary-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'vocabulary' },
            () => {
                displayVocab();
                updateWordCounter();
                if (adminLoggedIn) loadAdminData();
            }
        )
        .subscribe();
}

// ========== USER AUTHENTICATION ========== 
async function checkUserSession() {
    const savedUser = localStorage.getItem('koreanAppUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserUI();
        await loadUserStats();
    }
}

function updateUserUI() {
    const userInfo = document.getElementById('userInfo');
    if (currentUser) {
        userInfo.innerHTML = `
            <span class="user-badge">👤 ${currentUser.username}</span>
        `;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('profileSection').style.display = 'block';
        document.getElementById('profileUsername').textContent = currentUser.username;
        
        const joinDate = new Date(currentUser.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('profileJoinDate').textContent = `Membre depuis le ${joinDate}`;
        
        updateModeCounts();
    } else {
        userInfo.innerHTML = '<span style="color: var(--text-light);">Mode anonyme</span>';
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('profileSection').style.display = 'none';
    }
}

async function registerUser() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const messageDiv = document.getElementById('authMessage');

    if (!username || username.length < 3) {
        messageDiv.innerHTML = '<div class="alert alert-error">Le pseudo doit faire au moins 3 caractères</div>';
        return;
    }

    if (!password || password.length < 6) {
        messageDiv.innerHTML = '<div class="alert alert-error">Le mot de passe doit faire au moins 6 caractères</div>';
        return;
    }

    const { data: existing } = await client
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

    if (existing) {
        messageDiv.innerHTML = '<div class="alert alert-error">Ce pseudo est déjà pris</div>';
        return;
    }

    const { data, error } = await client
        .from('users')
        .insert([{ username, password }])
        .select()
        .single();

    if (error) {
        messageDiv.innerHTML = '<div class="alert alert-error">Erreur: ' + error.message + '</div>';
        return;
    }

    currentUser = data;
    localStorage.setItem('koreanAppUser', JSON.stringify(data));
    messageDiv.innerHTML = '<div class="alert alert-success">✅ Compte créé avec succès !</div>';
    
    setTimeout(() => {
        updateUserUI();
        messageDiv.innerHTML = '';
    }, 1500);
}

async function loginUser() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const messageDiv = document.getElementById('authMessage');

    if (!username || !password) {
        messageDiv.innerHTML = '<div class="alert alert-error">Remplis tous les champs</div>';
        return;
    }

    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        messageDiv.innerHTML = '<div class="alert alert-error">Pseudo ou mot de passe incorrect</div>';
        return;
    }

    currentUser = data;
    localStorage.setItem('koreanAppUser', JSON.stringify(data));
    messageDiv.innerHTML = '<div class="alert alert-success">✅ Connexion réussie !</div>';
    
    setTimeout(() => {
        updateUserUI();
        loadUserStats();
        messageDiv.innerHTML = '';
    }, 1000);
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem('koreanAppUser');
    updateUserUI();
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
}

// ========== USER STATS ========== 
async function loadUserStats() {
    if (!currentUser) return;

    const { data: sessions } = await client
        .from('user_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    document.getElementById('userTotalSessions').textContent = sessions?.length || 0;

    const { data: results } = await client
        .from('game_results')
        .select('*')
        .eq('user_id', currentUser.id);

    document.getElementById('userTotalGames').textContent = results?.length || 0;

    if (results && results.length > 0) {
        const totalCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0);
        const totalQuestions = results.reduce((sum, r) => sum + r.total_questions, 0);
        const successRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        document.getElementById('userSuccessRate').textContent = successRate + '%';
        
        const wordsLearned = await calculateWordsLearned(results);
        document.getElementById('totalWordsLearned').textContent = wordsLearned;
        
        document.getElementById('globalSuccessRate').textContent = successRate + '%';
        
        await generateRecommendations(results);
    } else {
        document.getElementById('totalWordsLearned').textContent = '0';
        document.getElementById('globalSuccessRate').textContent = '0%';
        document.getElementById('recommendationsList').innerHTML = '<p style="color: var(--text-secondary); font-style: italic; margin: 0;">Commence à jouer pour recevoir des recommandations personnalisées ! 🎮</p>';
    }

    const streak = calculateStreak(sessions);
    document.getElementById('userStreak').textContent = streak;

    await loadCategoryProgress();

    await loadRecentActivity();
}

async function calculateWordsLearned(results) {
    if (!results || results.length === 0) return 0;
    
    const categoriesPlayed = new Set();
    let totalCorrect = 0;
    
    results.forEach(result => {
        if (result.category) {
            categoriesPlayed.add(result.category);
        }
        totalCorrect += result.correct_answers || 0;
    });
    
    const estimatedWords = Math.max(1, Math.floor(totalCorrect / 2));
    
    return estimatedWords;
}

async function generateRecommendations(results) {
    if (!results || results.length === 0) return; 
    
    const categoryErrors = {};
    const wordErrors = {};
    
    results.forEach(result => {
        const category = result.category || 'Non catégorisé';
        
        if (!categoryErrors[category]) {
            categoryErrors[category] = {
                correct: 0,
                incorrect: 0,
                total: 0
            };
        }
        
        categoryErrors[category].correct += result.correct_answers || 0;
        categoryErrors[category].incorrect += (result.total_questions - result.correct_answers) || 0;
        categoryErrors[category].total += result.total_questions || 0;
        
        if (result.details && Array.isArray(result.details)) {
            result.details.forEach(detail => {
                if (!detail.correct && detail.word) {
                    const wordKey = detail.word.korean || detail.word;
                    wordErrors[wordKey] = (wordErrors[wordKey] || 0) + 1;
                }
            });
        }
    });
    
    let html = '';
    
    const weakCategories = Object.entries(categoryErrors)
        .map(([cat, stats]) => ({
            category: cat,
            rate: (stats.correct / stats.total) * 100,
            total: stats.total
        }))
        .filter(c => c.rate < 70 && c.total >= 5)
        .sort((a, b) => a.rate - b.rate);
    
    if (weakCategories.length > 0) {
        html += '<div style="margin-bottom: 15px;"><strong style="color: var(--accent);">📚 Catégories à réviser :</strong><ul style="margin: 8px 0 0 20px; color: var(--text-secondary);">';
        weakCategories.slice(0, 3).forEach(cat => {
            html += `<li><strong>${cat.category}</strong> (${cat.rate.toFixed(0)}% de réussite) - Utilise le mode "Mots difficiles" !</li>`;
        });
        html += '</ul></div>';
    }
    
    const difficultWords = Object.entries(wordErrors)
        .map(([word, errors]) => ({ word, errors }))
        .filter(w => w.errors >= 3)
        .sort((a, b) => b.errors - a.errors)
        .slice(0, 5);
    
    if (difficultWords.length > 0) {
        html += '<div style="margin-bottom: 15px;"><strong style="color: var(--accent);">🎯 Mots à revoir en priorité :</strong><ul style="margin: 8px 0 0 20px; color: var(--text-secondary);">';
        difficultWords.forEach(w => {
            html += `<li><strong>${w.word}</strong> (${w.errors} erreur${w.errors > 1 ? 's' : ''})</li>`;
        });
        html += '</ul></div>';
    }
    
    const totalCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0);
    const totalQuestions = results.reduce((sum, r) => sum + r.total_questions, 0);
    const globalRate = (totalCorrect / totalQuestions) * 100;
    
    if (globalRate >= 80) {
        html += '<div style="padding: 10px; background: var(--success-bg); border-radius: 8px; color: var(--text-primary);"><strong>🌟 Excellent travail !</strong> Continue comme ça, tu maîtrises très bien le vocabulaire !</div>';
    } else if (globalRate >= 60) {
        html += '<div style="padding: 10px; background: #fff9e6; border-radius: 8px; color: var(--text-primary);"><strong>💪 Bon rythme !</strong> Continue de pratiquer régulièrement pour progresser encore plus.</div>';
    } else {
        html += '<div style="padding: 10px; background: var(--error-bg); border-radius: 8px; color: var(--text-primary);"><strong>🚀 Ne lâche rien !</strong> La pratique régulière est la clé. Concentre-toi sur les catégories ci-dessus.</div>';
    }
    
    if (html === '') {
        html = '<div style="padding: 10px; background: var(--success-bg); border-radius: 8px; color: var(--text-primary);"><strong>🎉 Félicitations !</strong> Tu n\'as pas de faiblesses majeures détectées. Continue à t\'entraîner pour maintenir ton niveau !</div>';
    }
    
    document.getElementById('recommendationsList').innerHTML = html;
}

function calculateStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);

    const sessionDates = sessions.map(s => {
        const d = new Date(s.created_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    });

    const uniqueDates = [...new Set(sessionDates)].sort((a, b) => b - a);

    for (let i = 0; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (uniqueDates[i] < currentDate.getTime()) {
            break;
        }
    }

    return streak;
}

async function loadCategoryProgress() {
    if (!currentUser) return;

    const { data: results } = await client
        .from('game_results')
        .select('category, correct_answers, total_questions')
        .eq('user_id', currentUser.id);

    if (!results || results.length === 0) {
        document.getElementById('categoryProgress').innerHTML = '<p class="empty-message">Aucune progression pour le moment</p>';
        return;
    }

    const categoryStats = {};
    results.forEach(r => {
        if (!categoryStats[r.category]) {
            categoryStats[r.category] = { correct: 0, total: 0 };
        }
        categoryStats[r.category].correct += r.correct_answers;
        categoryStats[r.category].total += r.total_questions;
    });

    let html = '';
    for (const [category, stats] of Object.entries(categoryStats)) {
        const percentage = Math.round((stats.correct / stats.total) * 100);
        const displayCategory = category || 'Général';
        html += `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: 500; color: var(--text-secondary);">${displayCategory}</span>
                    <span style="color: var(--accent);">${percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }

    document.getElementById('categoryProgress').innerHTML = html;
}

async function loadRecentActivity() {
    if (!currentUser) return;

    const { data: sessions } = await client
        .from('user_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (!sessions || sessions.length === 0) {
        document.getElementById('recentActivity').innerHTML = '<p class="empty-message">Aucune activité récente</p>';
        return;
    }

    let html = '<div class="vocab-list">';
    sessions.forEach(session => {
        const date = new Date(session.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        const duration = session.duration_seconds ? Math.round(session.duration_seconds / 60) : 0;
        html += `
            <div class="vocab-card">
                <div>
                    <div style="font-weight: 600; color: var(--accent);">Session de ${session.game_type}</div>
                    <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 3px;">
                        ${session.category || 'Toutes catégories'} • ${duration} min
                    </div>
                    <div style="font-size: 0.75em; color: var(--text-light); margin-top: 3px;">${date}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    document.getElementById('recentActivity').innerHTML = html;
}

// ========== SESSION TRACKING ========== 
async function startSession(gameType, category) {
    if (!currentUser) return null;

    const { data, error } = await client
        .from('user_sessions')
        .insert([
            {
                user_id: currentUser.id,
                game_type: gameType,
                category: category || null
            }
        ])
        .select()
        .single();

    if (!error && data) {
        currentSession = data;
        sessionStartTime = Date.now();
        questionsAnswered = 0;
        sessionValid = false;
        sessionInProgress = true;
        return data;
    }
    return null;
}

async function endSession() {
    if (!currentSession) return;

    const duration = Math.round((Date.now() - sessionStartTime) / 1000);
    const isValidSession = duration >= 5 && questionsAnswered >= 1;
    
    if (isValidSession) {
        await client
            .from('user_sessions')
            .update({ duration_seconds: duration })
            .eq('id', currentSession.id);
        
        console.log('✅ Session valide enregistrée:', { duration, questionsAnswered });
    } else {
        await client
            .from('user_sessions')
            .delete()
            .eq('id', currentSession.id);
        
        console.log('❌ Session invalide supprimée:', { duration, questionsAnswered });
    }

    currentSession = null;
    sessionInProgress = false;
    sessionStartTime = null;
    questionsAnswered = 0;
}

// ========== Messages dynamiques selon score ========== 
function getDynamicMessage(correctCount, totalQuestions) {
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    let emoji = '';
    let title = '';
    let message = '';
    
    if (percentage === 100) {
        emoji = '🌟';
        title = 'PARFAIT !';
        message = 'Score parfait ! Tu maîtrises complètement le sujet !';
    } else if (percentage >= 90) {
        emoji = '🎉';
        title = 'Excellent !';
        message = 'Presque parfait ! Continue comme ça !';
    } else if (percentage >= 70) {
        emoji = '💪';
        title = 'Très bien !';
        message = 'Bonne maîtrise ! Encore un petit effort !';
    } else if (percentage >= 50) {
        emoji = '👍';
        title = 'Pas mal !';
        message = 'Un peu de révision et ce sera parfait !';
    } else {
        emoji = '📚';
        title = 'Continue !';
        message = 'Révise ces mots et retente ta chance !';
    }
    
    return { emoji, title, message, percentage };
}

async function saveGameResult(gameType, category, correctAnswers, totalQuestions) {
    if (!currentUser) return;

    await client
        .from('game_results')
        .insert([
            {
                user_id: currentUser.id,
                session_id: currentSession?.id || null,
                game_type: gameType,
                category: category || null,
                correct_answers: correctAnswers,
                total_questions: totalQuestions
            }
        ]);

    if (currentUser) {
        await loadUserStats();
    }
}

// ========== CONJUGATION LOGIC ========== 
const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const MEDIALS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function decompose(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return { initial: char, medial: '', final: '' };
    return {
        initial: INITIALS[Math.floor(code / 588)],
        medial: MEDIALS[Math.floor((code % 588) / 28)],
        final: FINALS[code % 28]
    };
}

function combine(initial, medial, final = '') {
    const initialIndex = INITIALS.indexOf(initial);
    const medialIndex = MEDIALS.indexOf(medial);
    const finalIndex = FINALS.indexOf(final);
    return String.fromCharCode(0xAC00 + initialIndex * 588 + medialIndex * 28 + finalIndex);
}

function getPresentTense(infinitive) {
    if (!infinitive || !infinitive.endsWith('다')) return infinitive;
    const stem = infinitive.slice(0, -1);
    if (stem.length === 0) return infinitive;
    if (stem.endsWith('하')) return stem.slice(0, -1) + '해요';
    const lastChar = stem.slice(-1);
    const stemBase = stem.slice(0, -1);
    const { initial, medial, final } = decompose(lastChar);
    if (final) {
        if (medial === 'ㅏ' || medial === 'ㅗ') return stem + '아요';
        else return stem + '어요';
    } else {
        switch (medial) {
            case 'ㅏ': case 'ㅑ': case 'ㅐ': case 'ㅔ': return stem + '요';
            case 'ㅗ': return stemBase + combine(initial, 'ㅘ') + '요';
            case 'ㅜ': return stemBase + combine(initial, 'ㅝ') + '요';
            case 'ㅣ': return stemBase + combine(initial, 'ㅕ') + '요';
            case 'ㅡ': return stemBase + combine(initial, 'ㅓ') + '요';
            case 'ㅓ': return stem + '요';
            default: return stem + '어요';
        }
    }
}

// ========== VOCABULARY ========== 
async function addWords() {
    const input = document.getElementById('newWords').value.trim();
    const category = document.getElementById('category').value;
    const userName = document.getElementById('userName').value.trim() ||
                    (currentUser ? currentUser.username : 'Anonyme');

    if (!input) {
        alert('Ajoute au moins un mot !');
        return;
    }

    // Fetch existing words to prevent duplicates
    const { data: existingWordsData, error: fetchError } = await client
        .from('vocabulary')
        .select('korean');

    if (fetchError) {
        alert('❌ Erreur lors de la vérification des doublons: ' + fetchError.message);
        return;
    }

    const existingKoreanWords = new Set(existingWordsData.map(w => w.korean));
    const lines = input.split('\n').filter(line => line.trim());
    const wordsToAdd = [];
    const wordsSkipped = [];

    lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length === 2) {
            const koreanWord = parts[0];
            const frenchWord = parts[1];

            if (existingKoreanWords.has(koreanWord)) {
                wordsSkipped.push(koreanWord);
                return; // Skip to next iteration
            }

            const newWord = {
                korean: koreanWord,
                french: frenchWord,
                category: category,
                added_by: userName
            };

            if (category === 'Verbes') {
                const present = getPresentTense(newWord.korean);
                newWord.conjugations = {
                    infinitive: newWord.korean,
                    present: present,
                    past: '',
                    future: ''
                };
            }

            wordsToAdd.push(newWord);
            existingKoreanWords.add(koreanWord); // Also prevent duplicates within the same batch
        }
    });

    let message = '';

    if (wordsToAdd.length > 0) {
        const { error } = await client.from('vocabulary').insert(wordsToAdd);
        if (error) {
            message += `❌ Erreur lors de l'ajout: ${error.message}\n`;
        } else {
            document.getElementById('newWords').value = '';
            message += `✅ ${wordsToAdd.length} mot(s) ajouté(s) !\n`;
        }
    }

    if (wordsSkipped.length > 0) {
        message += `ℹ️ ${wordsSkipped.length} mot(s) ignoré(s) car déjà existant(s): ${wordsSkipped.join(', ')}\n`;
    }

    if (message) {
        alert(message.trim());
    } else if (lines.length > 0) {
        alert('Aucun nouveau mot à ajouter. Le format est peut-être invalide ou les mots existent déjà.');
    } else {
        alert('Format invalide ! Utilise: coréen, français');
    }
}

async function displayVocab() {
    const filter = document.getElementById('filterCategory').value;
    let query = client.from('vocabulary').select('*').order('created_at', { ascending: false });

    if (filter) {
        query = query.eq('category', filter);
    }

    const { data, error } = await query;

    if (error) return;

    const list = document.getElementById('vocabList');
    const stats = document.getElementById('stats');

    stats.innerHTML = `${data.length} mot${data.length > 1 ? 's' : ''}`;

    if (data.length === 0) {
        list.innerHTML = '<p class="empty-message">Aucun mot</p>';
        return;
    }

    list.innerHTML = data.map(item => {
        const date = new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        return `
            <div class="vocab-card">
                <div>
                    <div class="vocab-korean">${item.korean}</div>
                    <div class="vocab-french">${item.french}</div>
                    <div class="vocab-meta">${item.category} • ${item.added_by} • ${date}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== Gestion des modes de session ========== 
function selectMode(mode) {
    sessionMode = mode;
    
    document.querySelectorAll('.mode-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('selected');
}

async function updateModeCounts() {
    const category = document.getElementById('gameCategory').value;
    let query = client.from('vocabulary').select('*');
    
    if (category) {
        query = query.eq('category', category);
    }
    
    const { data: vocab } = await query;
    if (!vocab) return;
    
    allVocabulary = vocab;
    
    // Adapter les labels selon le type de pratique
const wordLabel = practiceType === 'conjugation' ? 'verbes' : 'mots';

// Tous les mots/verbes
const allCount = Math.min(vocab.length, SESSION_WORD_LIMIT);
document.getElementById('modeCountAll').textContent = `${allCount} ${wordLabel}`;

// Nouveaux mots/verbes
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
const newWords = vocab.filter(w => new Date(w.created_at) >= sevenDaysAgo);
const newCount = Math.min(newWords.length, SESSION_WORD_LIMIT);
document.getElementById('modeCountNew').textContent = `${newCount} ${wordLabel}`;

// Mots/verbes en révision
const reviewWords = vocab.filter(w => new Date(w.created_at) < sevenDaysAgo);
const reviewCount = Math.min(reviewWords.length, SESSION_WORD_LIMIT);
document.getElementById('modeCountReview').textContent = `${reviewCount} ${wordLabel}`;

// Mots/verbes difficiles
if (currentUser) {
    const difficultWords = await getDifficultWords(vocab);
    const difficultCount = Math.min(difficultWords.length, SESSION_WORD_LIMIT);
    document.getElementById('modeCountDifficult').textContent = `${difficultCount} ${wordLabel}`;
} else {
    document.getElementById('modeCountDifficult').textContent = `0 ${wordLabel}`;
}

// Adapter aussi les noms des modes
const modeNames = document.querySelectorAll('.mode-name');
if (modeNames.length >= 4) {
    modeNames[1].textContent = `Nouveaux ${wordLabel}`;
    modeNames[3].textContent = practiceType === 'conjugation' ? 'Verbes difficiles' : 'Mots difficiles';
}
}

/**
 * Sélectionne le type de pratique et met à jour l'interface
 * @param {string} type - 'vocabulary' ou 'conjugation'
 */
function selectPracticeType(type) {
    practiceType = type;
    
    // Mise à jour visuelle des boutons
    document.querySelectorAll('.type-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');
    
    // Mise à jour du filtre de catégorie
    updateCategoryFilter();
    
    // Mise à jour des compteurs de mots
    updateModeCounts();
}

/**
 * Met à jour le menu déroulant des catégories selon le type de pratique
 */
function updateCategoryFilter() {
    const categorySelect = document.getElementById('gameCategory');
    const categoryLabel = document.querySelector('label[for="gameCategory"]');
    
    if (practiceType === 'vocabulary') {
        // Mode Vocabulaire
        categoryLabel.innerHTML = '📂 Catégorie';
        categorySelect.innerHTML = `
            <option value="">Toutes les catégories</option>
            <option value="Général">Général</option>
            <option value="Nombres">Nombres</option>
            <option value="Temps">Temps</option>
            <option value="Expressions">Expressions</option>
            <option value="Verbes">Verbes</option>
            <option value="Grammaire">Grammaire</option>
            <option value="Adjectifs">Adjectifs</option>
            <option value="Lieux">Lieux</option>
            <option value="Famille">Famille</option>
            <option value="Métiers">Métiers</option>
            <option value="Nourriture">Nourriture</option>
            <option value="Sports">Sports</option>
            <option value="Vêtements">Vêtements</option>
            <option value="Pays">Pays</option>
        `;
    } else if (practiceType === 'conjugation') {
        // Mode Conjugaison
        categoryLabel.innerHTML = '📝 Type de mots';
        categorySelect.innerHTML = `
            <option value="">Tous les verbes et adjectifs</option>
            <option value="Verbes">Tous les verbes</option>
            <option value="Conjugaison">Conjugaison</option>
            <option value="Adjectifs">Tous les adjectifs</option>
        `;
    }
}

async function getDifficultWords(vocabSet) {
    if (!currentUser) return [];
    
    const { data: results } = await client
        .from('game_results')
        .select('*')
        .eq('user_id', currentUser.id);
    
    if (!results || results.length === 0) return [];
    
    const categoryErrors = {};
    results.forEach(r => {
        const category = r.category || 'Général';
        if (!categoryErrors[category]) {
            categoryErrors[category] = { correct: 0, total: 0 };
        }
        categoryErrors[category].correct += r.correct_answers || 0;
        categoryErrors[category].total += r.total_questions || 0;
    });
    
    const difficultCategories = Object.entries(categoryErrors)
        .filter(([cat, stats]) => {
            const rate = stats.total > 0 ? (stats.correct / stats.total) : 1;
            return rate < 0.7;
        })
        .map(([cat]) => cat);
    
    return vocabSet.filter(w => difficultCategories.includes(w.category));
}

async function getWordsForSession(category) {
    let words = allVocabulary;
    
    // Filtrer par type de pratique
    if (practiceType === 'conjugation') {
        // Ne garder que Verbes et Adjectifs
        words = words.filter(w => w.category === 'Verbes' || w.category === 'Adjectifs');
    }
    
    // Filtrer par catégorie si nécessaire
    if (category) {
        words = words.filter(w => w.category === category);
    }
    
    switch(sessionMode) {
        case 'new':
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            words = words.filter(w => new Date(w.created_at) >= sevenDaysAgo);
            break;
            
        case 'review':
            const reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() - 7);
            words = words.filter(w => new Date(w.created_at) < reviewDate);
            break;
            
        case 'difficult':
            words = await getDifficultWords(words);
            break;
            
        case 'all':
        default:
            break;
    }
    
    words = words.sort(() => Math.random() - 0.5);
    return words.slice(0, SESSION_WORD_LIMIT);
}

// ========== GAMES ========== 
async function startGame(gameType) {
    const category = document.getElementById('gameCategory').value;
    
    const words = await getWordsForSession(category);

    if (words.length === 0) {
        alert('❌ Aucun mot disponible pour ce mode et cette catégorie');
        return;
    }

    const shuffledData = words.sort(() => Math.random() - 0.5);

    currentGame = gameType;
    currentGameSet = shuffledData;
    currentGameIndex = 0;

    window.memoryCards = null;
    window.memoryMatched = null;
    window.memoryFlipped = null;

    await startSession(gameType, category);

    document.querySelector('.games-grid').parentElement.style.display = 'none';
    const container = document.getElementById('gameContainer');
    container.style.display = 'block';

    if (gameType === 'quiz') showQuizQuestion();
    else if (gameType === 'quiz-inverse') showQuizInverseQuestion();
    else if (gameType === 'cartes') showFlashcard();
    else if (gameType === 'memory') showMemory();
    else if (gameType === 'ecriture') showWritingQuestion();
}

function resetGames() {
    if (sessionInProgress && questionsAnswered > 0) {
        const confirmed = confirm(
            '⚠️ Es-tu sûr de vouloir quitter ?\n\n' +
            'Ta progression sera perdue.\n' +
            `Questions répondues : ${questionsAnswered}`
        );
        
        if (!confirmed) {
            return;
        }
    }
    
    if (currentSession) {
        endSession();
    }
    document.querySelector('.games-grid').parentElement.style.display = 'block';
    document.querySelector('.mode-selector').style.display = 'block';
    document.getElementById('gameContainer').style.display = 'none';
}

function getConjugationDistractors(currentWord, allVocab, count = 3) {
    const distractors = [];
    const correctConjugation = currentWord.conjugations.present;

    const otherVerbs = allVocab.filter(
        v => v.id !== currentWord.id && v.category === 'Verbes' && v.conjugations && v.conjugations.present
    );

    const availableConjugations = [...new Set(otherVerbs.map(v => v.conjugations.present))];

    while (distractors.length < count && availableConjugations.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableConjugations.length);
        const potentialDistractor = availableConjugations.splice(randomIndex, 1)[0];
        if (potentialDistractor !== correctConjugation) {
            distractors.push(potentialDistractor);
        }
    }
    return distractors;
}

function showQuizQuestion() {
    const container = document.getElementById('gameContainer');
    if (currentGameIndex >= currentGameSet.length) {
        const correctCount = window.quizCorrectCount || 0;
        saveGameResult('quiz', document.getElementById('gameCategory').value, correctCount, currentGameSet.length);
        endSession();
        
        const dynamicMsg = getDynamicMessage(correctCount, currentGameSet.length);

        container.innerHTML = `
            <div class="quiz-container">
                <div style="font-size: 2.5em; margin-bottom: 15px;">${dynamicMsg.emoji}</div>
                <h2 style="color: var(--accent); margin-bottom: 10px;">${dynamicMsg.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 1.1em;">${dynamicMsg.message}</p>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">Score: ${correctCount}/${currentGameSet.length}</p>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">Taux de réussite: ${dynamicMsg.percentage}%</p>
                <button class="btn-primary" id="quizReturnBtn">← Retour</button>
            </div>
        `;
        document.getElementById('quizReturnBtn').addEventListener('click', resetGames);
        window.quizCorrectCount = 0;
        return;
    }

    if (currentGameIndex === 0) {
        window.quizCorrectCount = 0;
    }

    const current = currentGameSet[currentGameIndex];
    let questionText;
    let correctAnswer;
    let options = [];

    if (current.category === 'Verbes' && current.conjugations && current.conjugations.present) {
        questionText = `${current.conjugations.infinitive} (Présent)`;
        correctAnswer = current.conjugations.present;
        options = [correctAnswer, ...getConjugationDistractors(current, allVocabulary, 3)];
    } else {
        questionText = current.korean;
        correctAnswer = current.french;
        const otherVocab = currentGameSet.filter(v => v.id !== current.id);
        options = [correctAnswer];
        for (let i = 0; i < 3 && otherVocab.length > 0; i++) {
            const random = otherVocab.splice(Math.floor(Math.random() * otherVocab.length), 1)[0];
            options.push(random.french);
        }
    }

    options.sort(() => Math.random() - 0.5);

    container.innerHTML = `
        <div class="quiz-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="quiz-type">Question ${currentGameIndex + 1}/${currentGameSet.length}</div>
                <button class="btn-secondary" id="quizGameReturnBtn" style="padding: 8px 16px; font-size: 0.9em;">← Retour</button>
            </div>
            <div class="quiz-word">${questionText}</div>
            <div class="quiz-options">
                ${options.map((opt, idx) => `
                    <button class="quiz-option" data-idx="${idx}" data-correct="${correctAnswer.replace(/"/g, '&quot;')}" data-answer="${opt.replace(/"/g, '&quot;')}">${opt}</button>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('quizGameReturnBtn').addEventListener('click', resetGames);
    document.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', (event) => {
            checkQuizAnswer(currentGameIndex, parseInt(event.target.dataset.idx), event.target.dataset.correct);
        });
    });
}

function checkQuizAnswer(questionIndex, selectedIdx, expectedAnswer) {
    questionsAnswered++;
    const current = currentGameSet[questionIndex];
    const buttons = document.querySelectorAll('.quiz-option');
    
    const correctIdx = Array.from(buttons).findIndex(btn => btn.textContent === expectedAnswer);
    
    if (selectedIdx === correctIdx) {
        window.quizCorrectCount = (window.quizCorrectCount || 0) + 1;
    }
    
    buttons.forEach((btn, idx) => {
        if (idx === correctIdx) btn.classList.add('correct');
        if (idx === selectedIdx && selectedIdx !== correctIdx) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    setTimeout(() => {
        currentGameIndex++;
        showQuizQuestion();
    }, 1000);
}

function showQuizInverseQuestion() {
    const container = document.getElementById('gameContainer');
    if (currentGameIndex >= currentGameSet.length) {
        const correctCount = window.quizInverseCorrectCount || 0;
        saveGameResult('quiz-inverse', document.getElementById('gameCategory').value, correctCount, currentGameSet.length);
        endSession();
        
        const dynamicMsg = getDynamicMessage(correctCount, currentGameSet.length);

        container.innerHTML = `
            <div class="quiz-container">
                <div style="font-size: 2.5em; margin-bottom: 15px;">${dynamicMsg.emoji}</div>
                <h2 style="color: var(--accent); margin-bottom: 10px;">${dynamicMsg.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 1.1em;">${dynamicMsg.message}</p>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">Score: ${correctCount}/${currentGameSet.length}</p>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">Taux de réussite: ${dynamicMsg.percentage}%</p>
                <button class="btn-primary" id="quizInverseReturnBtn">← Retour</button>
            </div>
        `;
        document.getElementById('quizInverseReturnBtn').addEventListener('click', resetGames);
        window.quizInverseCorrectCount = 0;
        return;
    }

    if (currentGameIndex === 0) {
        window.quizInverseCorrectCount = 0;
    }

    const current = currentGameSet[currentGameIndex];
    const options = [current.korean];
    const otherVocab = currentGameSet.filter(v => v.id !== current.id);

    for (let i = 0; i < 3 && otherVocab.length > 0; i++) {
        const random = otherVocab.splice(Math.floor(Math.random() * otherVocab.length), 1)[0];
        options.push(random.korean);
    }

    options.sort(() => Math.random() - 0.5);

    container.innerHTML = `
        <div class="quiz-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="quiz-type">Question ${currentGameIndex + 1}/${currentGameSet.length}</div>
                <button class="btn-secondary" id="quizInverseGameReturnBtn" style="padding: 8px 16px; font-size: 0.9em;">← Retour</button>
            </div>
            <div class="quiz-word">${current.french}</div>
            <div style="font-size: 0.9em; color: var(--text-light); margin-bottom: 15px;">Quel est le mot coréen ?</div>
            <div class="quiz-options">
                ${options.map((opt, idx) => `
                    <button class="quiz-option" data-idx="${idx}" data-correct="${current.korean.replace(/"/g, '&quot;')}" data-answer="${opt.replace(/"/g, '&quot;')}">${opt}</button>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('quizInverseGameReturnBtn').addEventListener('click', resetGames);
    document.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', (event) => {
            checkQuizInverseAnswer(currentGameIndex, parseInt(event.target.dataset.idx));
        });
    });
}

function checkQuizInverseAnswer(questionIndex, selectedIdx) {
    questionsAnswered++;
    const current = currentGameSet[questionIndex];
    const buttons = document.querySelectorAll('.quiz-option');
    
    const correctIdx = Array.from(buttons).findIndex(btn => btn.textContent === current.korean);
    
    if (selectedIdx === correctIdx) {
        window.quizInverseCorrectCount = (window.quizInverseCorrectCount || 0) + 1;
    }
    
    buttons.forEach((btn, idx) => {
        if (idx === correctIdx) btn.classList.add('correct');
        if (idx === selectedIdx && selectedIdx !== correctIdx) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    setTimeout(() => {
        currentGameIndex++;
        showQuizInverseQuestion();
    }, 1000);
}

function showFlashcard() {
    const container = document.getElementById('gameContainer');
    if (currentGameIndex >= currentGameSet.length) {
        saveGameResult('cartes', document.getElementById('gameCategory').value, currentGameSet.length, currentGameSet.length);
        endSession();
        
        container.innerHTML = `
            <div class="quiz-container">
                <div style="font-size: 2.5em; margin-bottom: 15px;">✨</div>
                <h2 style="color: var(--accent);">Cartes terminées !</h2>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">Bien joué !</p>
                <button class="btn-primary" id="flashcardReturnBtn" style="width: 150px;">← Retour</button>
            </div>
        `;
        document.getElementById('flashcardReturnBtn').addEventListener('click', resetGames);
        return;
    }

    const current = currentGameSet[currentGameIndex];
    container.innerHTML = `
        <div class="quiz-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="quiz-type">${currentGameIndex + 1}/${currentGameSet.length}</div>
                <button class="btn-secondary" id="flashcardGameReturnBtn" style="padding: 8px 16px; font-size: 0.9em;">← Retour</button>
            </div>
            <div class="flashcard" id="flashcardFlip">
                <div class="flashcard-inner">
                    <div class="flashcard-front">${current.korean}</div>
                    <div class="flashcard-back">${current.french}</div>
                </div>
            </div>
            <div class="button-group">
                <button class="btn-primary" id="flashcardNextBtn">Suivant →</button>
            </div>
        </div>
    `;
    document.getElementById('flashcardGameReturnBtn').addEventListener('click', resetGames);
    document.getElementById('flashcardFlip').addEventListener('click', function() { this.classList.toggle('flipped'); });
    document.getElementById('flashcardNextBtn').addEventListener('click', () => { questionsAnswered++; currentGameIndex++; showFlashcard(); });
}

function showMemory() {
    const container = document.getElementById('gameContainer');
    
    if (!window.memoryCards) {
        const memorySet = currentGameSet.slice(0, 6);
        const cards = [];
        memorySet.forEach(word => {
            cards.push({ value: word.korean, id: word.id });
            cards.push({ value: word.korean, id: word.id });
        });
        cards.sort(() => Math.random() - 0.5);
        window.memoryCards = cards;
        window.memoryMatched = [];
        window.memoryFlipped = [];
    }

    const cards = window.memoryCards;
    const matched = window.memoryMatched;
    const flipped = window.memoryFlipped;
    const totalPairs = cards.length / 2;
    const foundPairs = matched.length / 2;

    if (foundPairs === totalPairs && foundPairs > 0) {
        saveGameResult('memory', document.getElementById('gameCategory').value, totalPairs, totalPairs);
        endSession();
    }

    container.innerHTML = `
        <div class="quiz-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="quiz-type">Mémory - ${foundPairs}/${totalPairs} paires trouvées</div>
                <button class="btn-secondary" id="memoryGameReturnBtn" style="padding: 8px 16px; font-size: 0.9em;">← Retour</button>
            </div>
            <div class="memory-grid">
                ${cards.map((card, idx) => `
                    <button class="memory-card ${matched.includes(idx) ? 'matched' : ''} ${flipped.includes(idx) ? 'flipped' : ''}" 
                        id="card-${idx}" data-idx="${idx}">
                        ${(matched.includes(idx) || flipped.includes(idx)) ? card.value : '?'} 
                    </button>
                `).join('')}
            </div>
            ${foundPairs === totalPairs ? `
                <div style="margin-top: 20px; text-align: center;">
                    <div style="font-size: 2em; margin-bottom: 10px;">🎉</div>
                    <p style="color: var(--text-secondary); margin-bottom: 15px;">Tu as trouvé toutes les paires !</p>
                    <button class="btn-primary" id="memoryReturnBtn" style="width: 150px;">← Retour</button>
                </div>
            ` : ''}
        </div>
    `;
    document.getElementById('memoryGameReturnBtn').addEventListener('click', resetGames);
    if (foundPairs === totalPairs) {
        document.getElementById('memoryReturnBtn').addEventListener('click', resetGames);
    }
    document.querySelectorAll('.memory-card').forEach(card => {
        card.addEventListener('click', (event) => {
            flipMemoryCard(parseInt(event.target.dataset.idx));
        });
    });
}

function flipMemoryCard(idx) {
    const cards = window.memoryCards;
    const matched = window.memoryMatched;
    const flipped = window.memoryFlipped;

    if (window.memoryProcessing || matched.includes(idx) || flipped.includes(idx) || flipped.length >= 2) return;

    flipped.push(idx);
    showMemory();

    if (flipped.length === 2) {
        window.memoryProcessing = true;
        
        const card1 = cards[flipped[0]];
        const card2 = cards[flipped[1]];

        if (card1.value === card2.value && flipped[0] !== flipped[1]) {
            questionsAnswered++;
            matched.push(flipped[0]);
            matched.push(flipped[1]);
            window.memoryFlipped = [];
            setTimeout(() => {
                window.memoryProcessing = false;
                showMemory();
            }, 500);
        } else {
            setTimeout(() => {
                window.memoryFlipped = [];
                window.memoryProcessing = false;
                showMemory();
            }, 1000);
        }
    }
}

function showWritingQuestion() {
    const container = document.getElementById('gameContainer');
    if (currentGameIndex >= currentGameSet.length) {
        const correctCount = window.writingCorrectCount || 0;
        saveGameResult('ecriture', document.getElementById('gameCategory').value, correctCount, currentGameSet.length);
        endSession();
        
        const dynamicMsg = getDynamicMessage(correctCount, currentGameSet.length);

        container.innerHTML = `
            <div class="quiz-container">
                <div style="font-size: 2.5em; margin-bottom: 15px;">${dynamicMsg.emoji}</div>
                <h2 style="color: var(--accent); margin-bottom: 10px;">${dynamicMsg.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 1.1em;">${dynamicMsg.message}</p>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">Score: ${correctCount}/${currentGameSet.length}</p>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">Taux de réussite: ${dynamicMsg.percentage}%</p>
                <button class="btn-primary" id="writingReturnBtn">← Retour</button>
            </div>
        `;
        document.getElementById('writingReturnBtn').addEventListener('click', resetGames);
        window.writingCorrectCount = 0;
        return;
    }

    if (currentGameIndex === 0) {
        window.writingCorrectCount = 0;
    }

    const current = currentGameSet[currentGameIndex];
    let questionText;
    let promptText;

    if (current.category === 'Verbes' && current.conjugations && current.conjugations.present) {
        questionText = `${current.french} (Présent)`;
        promptText = 'Écris la conjugaison au présent';
    } else {
        questionText = current.french;
        promptText = 'Écris le mot en coréen';
    }

    container.innerHTML = `
        <div class="quiz-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="quiz-type">Écriture ${currentGameIndex + 1}/${currentGameSet.length}</div>
                <button class="btn-secondary" id="writingGameReturnBtn" style="padding: 8px 16px; font-size: 0.9em;">← Retour</button>
            </div>
            <div class="quiz-word">${questionText}</div>
            <div style="font-size: 0.9em; color: var(--text-light); margin-bottom: 15px;">${promptText}</div>
            <input type="text" id="writingInput" class="writing-input" placeholder="Tape ici...">
            <div id="writingFeedback" class="writing-feedback"></div>
            <div class="button-group">
                <button class="btn-primary" id="writingCheckBtn">Vérifier</button>
                <button class="btn-secondary" id="writingSkipBtn">Passer</button>
            </div>
        </div>
    `;
    document.getElementById('writingGameReturnBtn').addEventListener('click', resetGames);
    document.getElementById('writingCheckBtn').addEventListener('click', checkWritingAnswer);
    document.getElementById('writingSkipBtn').addEventListener('click', skipWritingQuestion);
    document.getElementById('writingInput').focus();
}

function checkWritingAnswer() {
    const input = document.getElementById('writingInput').value.trim();
    const current = currentGameSet[currentGameIndex];
    const feedback = document.getElementById('writingFeedback');
    if (!input) { return; }

    questionsAnswered++;

    const expectedAnswer = (current.category === 'Verbes' && current.conjugations) ? current.conjugations.present : current.korean;

    if (input === expectedAnswer) {
        window.writingCorrectCount = (window.writingCorrectCount || 0) + 1;
        feedback.textContent = '✅ Correct !';
        feedback.className = 'writing-feedback correct';
        setTimeout(() => {
            currentGameIndex++;
            showWritingQuestion();
        }, 1500);
    } else {
        feedback.textContent = `❌ Non, c\'est "${expectedAnswer}"`;
        feedback.className = 'writing-feedback incorrect';
    }
}

function skipWritingQuestion() {
    currentGameIndex++;
    showWritingQuestion();
}

// ========== ADMIN ========== 
function loginAdmin() {
    const pass = document.getElementById('adminPassword').value;
    if (pass === ADMIN_PASSWORD) {
        adminLoggedIn = true;
        document.getElementById('adminLoginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    } else {
        alert('❌ Mot de passe incorrect');
    }
}

function logoutAdmin() {
    adminLoggedIn = false;
    document.getElementById('adminLoginForm').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    
    if (activityChart) activityChart.destroy();
    if (gamesChart) gamesChart.destroy();
}

async function loadAdminData() {
    if (!adminLoggedIn) return;

    const categoryFilter = document.getElementById('adminCategoryFilter')?.value || '';

    let vocabQuery = client.from('vocabulary').select('*');
    if (categoryFilter) {
        vocabQuery = vocabQuery.eq('category', categoryFilter);
    }
    const { data: vocab } = await vocabQuery.order('created_at', { ascending: false });
    
    document.getElementById('adminTotalWords').innerText = vocab?.length || 0;

    const { data: users } = await client.from('users').select('*');
    document.getElementById('adminTotalUsers').innerText = users?.length || 0;

    const { data: sessions } = await client.from('user_sessions').select('*');
    document.getElementById('adminTotalSessions').innerText = sessions?.length || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = new Set(sessions?.filter(s => new Date(s.created_at) >= sevenDaysAgo).map(s => s.user_id));
    document.getElementById('adminActiveUsers').innerText = activeUsers.size;

    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = vocab?.map(item => {
        const date = new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        return `
            <tr>
                <td><strong>${item.korean}</strong></td>
                <td>${item.french}</td>
                <td>${item.category}</td>
                <td>${item.added_by}</td>
                <td>${date}</td>
                <td>
                    <button class="btn-danger" data-id="${item.id}" data-korean="${item.korean.replace(/"/g, '&quot;')}" onclick="deleteVocabWord(\'${item.id}\', '${item.korean.replace(/'/g, "\'")}')">🗑️ Supprimer</button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="6" style="text-align: center;">Aucun mot</td></tr>';

    // Tableau utilisateurs
    const usersTableBody = document.getElementById('adminUsersTable');
    if (usersTableBody && users) {
        usersTableBody.innerHTML = users.map(user => {
            const joinDate = new Date(user.created_at).toLocaleDateString('fr-FR', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            
            const lastActivityDate = user.last_activity 
                ? new Date(user.last_activity).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'short',
                    year: 'numeric'
                })
                : 'Jamais';
            
            const userSessions = sessions?.filter(s => s.user_id === user.id) || [];
            
            return `
                <tr>
                    <td><strong>${user.username}</strong></td>
                    <td>${userSessions.length}</td>
                    <td>${lastActivityDate}</td>
                    <td>${joinDate}</td>
                    <td>
                        <button class="btn-danger" onclick="deleteUser(${user.id}, '${user.username.replace(/'/g, "\'")}')">🗑️ Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" style="text-align: center;">Aucun utilisateur</td></tr>';
    }

    // Graphiques
    renderActivityChart(sessions);
    renderGamesChart(sessions);
}

function renderActivityChart(sessions) {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (activityChart) activityChart.destroy();
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    }
    
    const sessionCounts = last7Days.map((day, index) => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - index));
        targetDate.setHours(0, 0, 0, 0);
        
        return sessions?.filter(s => {
            const sessionDate = new Date(s.created_at);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === targetDate.getTime();
        }).length || 0;
    });
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Sessions',
                data: sessionCounts,
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderGamesChart(sessions) {
    const canvas = document.getElementById('gamesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (gamesChart) gamesChart.destroy();
    
    const gameCounts = {
        'quiz': 0,
        'quiz-inverse': 0,
        'cartes': 0,
        'memory': 0,
        'ecriture': 0
    };
    
    sessions?.forEach(s => {
        if (gameCounts.hasOwnProperty(s.game_type)) {
            gameCounts[s.game_type]++;
        }
    });
    
    const gameLabels = {
        'quiz': '❓ Quiz',
        'quiz-inverse': '🔄 Quiz Inverse',
        'cartes': '🃏 Cartes',
        'memory': '🧠 Memory',
        'ecriture': '✍️ Écriture'
    };
    
    gamesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(gameCounts).map(k => gameLabels[k]),
            datasets: [{
                data: Object.values(gameCounts),
                backgroundColor: [
                    'rgb(147, 51, 234)',
                    'rgb(236, 72, 153)',
                    'rgb(59, 130, 246)',
                    'rgb(34, 197, 94)',
                    'rgb(249, 115, 22)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

async function deleteVocabWord(wordId, korean) {
    if (!confirm(`⚠️ Supprimer le mot \"${korean}\" ?

Cette action est irréversible.`)) return; 
    
    const { error } = await client
        .from('vocabulary')
        .delete()
        .eq('id', wordId);
    
    if (error) {
        alert('❌ Erreur: ' + error.message);
    } else {
        alert('✅ Mot supprimé avec succès');
        loadAdminData();
        displayVocab();
        updateWordCounter();
    }
}

async function deleteUser(id, username) {
    if (!confirm(`Supprimer l\'utilisateur "${username}" ?\n\nCette action est irréversible et supprimera aussi toutes ses sessions.`)) return;
    
    // Supprimer d'abord les sessions de l'utilisateur
    await client.from('user_sessions').delete().eq('user_id', id);
    await client.from('game_results').delete().eq('user_id', id);
    
    // Puis supprimer l'utilisateur
    const { error } = await client.from('users').delete().eq('id', wordId);
    
    if (error) {
        alert('❌ Erreur: ' + error.message);
    } else {
        alert('✅ Utilisateur supprimé');
        loadAdminData();
    }
}

function filterVocabByCategory() {
    loadAdminData();
}

async function exportAdminData() {
    const { data: vocab } = await client.from('vocabulary').select('*');
    const { data: users } = await client.from('users').select('*');
    const { data: sessions } = await client.from('user_sessions').select('*');
    
    const exportData = {
        vocabulary: vocab,
        users: users,
        sessions: sessions,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `korean-vocab-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

async function exportStatsReport() {
    const { data: vocab } = await client.from('vocabulary').select('*');
    const { data: users } = await client.from('users').select('*');
    const { data: sessions } = await client.from('user_sessions').select('*');
    
    let report = '📊 RAPPORT STATISTIQUES - Application Vocabulaire Coréen\n';
    report += '='.repeat(60) + '\n\n';
    report += `Date: ${new Date().toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}

`;
    
    report += '📚 VOCABULAIRE\n';
    report += '-'.repeat(60) + '\n';
    report += `Total de mots: ${vocab?.length || 0}\n`;
    
    const categoryCounts = {};
    vocab?.forEach(v => {
        categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;
    });
    report += '\nMots par catégorie:\n';
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        report += `  ${cat}: ${count} mots\n`;
    });
    
    report += '\n👥 UTILISATEURS\n';
    report += '-'.repeat(60) + '\n';
    report += `Total d\'utilisateurs: ${users?.length || 0}\n`;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = new Set(sessions?.filter(s => new Date(s.created_at) >= sevenDaysAgo).map(s => s.user_id));
    report += `Utilisateurs actifs (7 derniers jours): ${activeUsers.size}\n`;
    
    report += '\n🎮 SESSIONS DE JEU\n';
    report += '-'.repeat(60) + '\n';
    report += `Total de sessions: ${sessions?.length || 0}\n`;
    
    const gameCounts = {};
    sessions?.forEach(s => {
        gameCounts[s.game_type] = (gameCounts[s.game_type] || 0) + 1;
    });
    
    const gameLabels = {
        'quiz': '❓ Quiz',
        'quiz-inverse': '🔄 Quiz Inverse',
        'cartes': '🃏 Cartes',
        'memory': '🧠 Memory',
        'ecriture': '✍️ Écriture'
    };
    
    report += '\nSessions par jeu:\n';
    Object.entries(gameCounts).sort((a, b) => b[1] - a[1]).forEach(([game, count]) => {
        report += `  ${gameLabels[game] || game}: ${count} sessions\n`;
    });
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-stats-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
}

async function cleanInactiveUsers() {
    const confirmed = confirm(
        '⚠️ ATTENTION\n\n' +
        'Cette action va supprimer tous les utilisateurs inactifs depuis plus de 90 jours.\n\n' +
        'Continuer ?'
    );
    
    if (!confirmed) return; 
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: users } = await client.from('users').select('*');
    const { data: sessions } = await client.from('user_sessions').select('*');
    
    const inactiveUsers = users?.filter(user => {
        const userSessions = sessions?.filter(s => s.user_id === user.id) || [];
        if (userSessions.length === 0) return true;
        
        const lastSession = userSessions.reduce((latest, s) => {
            const sessionDate = new Date(s.created_at);
            return sessionDate > latest ? sessionDate : latest;
        }, new Date(0));
        
        return lastSession < ninetyDaysAgo;
    }) || [];
    
    if (inactiveUsers.length === 0) {
        alert('✅ Aucun utilisateur inactif à supprimer');
        return;
    }
    
    const finalConfirm = confirm(
        `Supprimer ${inactiveUsers.length} utilisateur(s) inactif(s) ?\n\n` +
        'Cette action est irréversible.'
    );
    
    if (!finalConfirm) return;
    
    for (const user of inactiveUsers) {
        await client.from('user_sessions').delete().eq('user_id', user.id);
        await client.from('game_results').delete().eq('user_id', user.id);
        await client.from('users').delete().eq('id', user.id);
    }
    
    alert(`✅ ${inactiveUsers.length} utilisateur(s) supprimé(s)`);
    loadAdminData();
}