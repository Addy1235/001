// Flashcard Application - Folder/Set Architecture
class FlashcardApp {
    constructor() {
        this.countries = [
            { code: "de", name: "German" }, { code: "ru", name: "Russian" }, { code: "gb", name: "English" },
            { code: "fr", name: "French" }, { code: "es", name: "Spanish" }, { code: "it", name: "Italian" },
            { code: "pt", name: "Portuguese" }, { code: "nl", name: "Dutch" }, { code: "pl", name: "Polish" },
            { code: "jp", name: "Japanese" }, { code: "cn", name: "Chinese" }, { code: "kr", name: "Korean" },
            { code: "vn", name: "Vietnamese" }, { code: "th", name: "Thai" }, { code: "id", name: "Indonesian" },
            { code: "ar", name: "Arabic" }, { code: "tr", name: "Turkish" }, { code: "gr", name: "Greek" },
            { code: "se", name: "Swedish" }, { code: "no", name: "Norwegian" }, { code: "dk", name: "Danish" },
            { code: "fi", name: "Finnish" }, { code: "cz", name: "Czech" }, { code: "hu", name: "Hungarian" },
            { code: "ro", name: "Romanian" }, { code: "ua", name: "Ukrainian" }, { code: "in", name: "Hindi" },
            { code: "il", name: "Hebrew" }, { code: "ir", name: "Persian" }, { code: "pk", name: "Urdu" }
        ];
        this.selectedCountry = null;
        this.data = { folders: { german: { name: "German", flag: "de", sets: [] }, russian: { name: "Russian", flag: "ru", sets: [] }, english: { name: "English", flag: "gb", sets: [] } } };
        this.folderOrder = ["german", "russian", "english"];
        this.tempFolderOrder = [];
        this.currentFolder = null; this.currentSet = null; this.currentCards = []; this.currentIndex = 0; this.studyCards = [];
        this.editingCardId = null; this.editingSetId = null; this.currentMode = "flashcards"; this.isShuffled = false; this.showTermFirst = true;
        this.learnIndex = 0; this.learnCorrect = 0; this.matchTimer = null; this.matchTime = 0; this.selectedTile = null; this.matchedPairs = 0;
        this.draggedItem = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.currentImageData = null;
        this.authMode = 'login'; // 'login' or 'register'
        this.init();
    }
    init() {
        this.loadData();
        this.migrateCardsSR();
        this.loadStreakData();
        this.bindEvents();
        this.showLibrary();
        this.initDateTime();
        this.updateStreakUI();
        this.loadVoices();
        this.initAuth();
        this.initTouchGestures();
    }

    initDateTime() {
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
    }

    updateDateTime() {
        const now = new Date();
        const timeEl = document.getElementById('datetime-time');
        const dateEl = document.getElementById('datetime-date');
        if (timeEl && dateEl) {
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeEl.textContent = `${hours}:${minutes}`;
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
        }
    }
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
    getFlagUrl(code) { return `https://flagcdn.com/48x36/${code}.png`; }
    isCountryCode(flag) { return /^[a-z]{2}$/.test(flag); }

    // ========================================
    // SPACED REPETITION (SM-2 Algorithm)
    // ========================================

    getDefaultSRData() {
        return {
            easeFactor: 2.5,      // Ease factor (min 1.3)
            interval: 0,          // Days until next review
            repetitions: 0,       // Successful reviews in a row
            nextReview: null,     // ISO date string
            lastReview: null      // ISO date string
        };
    }

    // Quality: 0=Again, 1=Hard, 2=Good, 3=Easy
    calculateSR(card, quality) {
        const sr = card.sr || this.getDefaultSRData();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let { easeFactor, interval, repetitions } = sr;

        if (quality === 0) {
            // Again - reset progress
            repetitions = 0;
            interval = 0;
        } else {
            // Successful review - optimized shorter intervals
            if (repetitions === 0) {
                // First success: 10min, 1d, 2d based on quality
                interval = quality === 1 ? 0 : quality === 2 ? 1 : 2;
            } else if (repetitions === 1) {
                // Second success: 1d, 2d, 4d
                interval = quality === 1 ? 1 : quality === 2 ? 2 : 4;
            } else if (repetitions === 2) {
                // Third success: 3d, 5d, 7d
                interval = quality === 1 ? 3 : quality === 2 ? 5 : 7;
            } else {
                // Later reviews: use ease factor with modest growth
                interval = Math.round(interval * easeFactor);
                if (quality === 1) interval = Math.max(1, Math.round(interval * 0.7));
                if (quality === 3) interval = Math.round(interval * 1.2);
            }
            repetitions++;

            // Adjust ease factor based on quality
            const qualityAdjust = [0, -0.15, 0, 0.1];
            easeFactor = Math.max(1.3, Math.min(2.5, easeFactor + qualityAdjust[quality]));
        }

        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + (quality === 0 ? 0 : interval));

        return {
            easeFactor: Math.round(easeFactor * 100) / 100,
            interval,
            repetitions,
            nextReview: nextReview.toISOString().split('T')[0],
            lastReview: now.toISOString().split('T')[0]
        };
    }

    reviewCard(quality) {
        if (this.studyCards.length === 0) return;
        const card = this.studyCards[this.currentIndex];
        const set = this.getCurrentSetObject();
        if (!set) return;

        const originalCard = set.cards.find(c => c.id === card.id);
        if (!originalCard) return;

        // Initialize SR data if missing
        if (!originalCard.sr) originalCard.sr = this.getDefaultSRData();

        // Calculate new SR values
        originalCard.sr = this.calculateSR(originalCard, quality);
        card.sr = { ...originalCard.sr };

        // Update mastery based on SR progress
        if (quality === 0) {
            originalCard.mastery = "learning";
        } else if (originalCard.sr.repetitions >= 3) {
            originalCard.mastery = "mastered";
        } else {
            originalCard.mastery = "learning";
        }
        card.mastery = originalCard.mastery;

        this.saveData();
        this.updateMasteryButtons(card);
        this.updateProgressTracking();
        this.updateSRStats();

        // Update streak on successful review
        this.updateStreak();

        // Auto-advance to next card after review
        if (quality > 0) {
            setTimeout(() => this.nextCard(), 300);
        }
    }

    getDueCards(set) {
        if (!set || !set.cards) return [];
        const today = new Date().toISOString().split('T')[0];
        return set.cards.filter(card => {
            if (!card.sr || !card.sr.nextReview) return true; // New cards are due
            return card.sr.nextReview <= today;
        });
    }

    getNewCards(set) {
        if (!set || !set.cards) return [];
        return set.cards.filter(card => !card.sr || card.sr.repetitions === 0);
    }

    getReviewCards(set) {
        if (!set || !set.cards) return [];
        const today = new Date().toISOString().split('T')[0];
        return set.cards.filter(card => {
            if (!card.sr || card.sr.repetitions === 0) return false;
            return card.sr.nextReview <= today;
        });
    }

    updateSRStats() {
        const set = this.getCurrentSetObject();
        if (!set) return;

        const dueCards = this.getDueCards(set);
        const newCards = this.getNewCards(set);
        const reviewCards = this.getReviewCards(set);

        // Update due count display if exists
        const dueCountEl = document.getElementById('due-cards-count');
        if (dueCountEl) {
            dueCountEl.textContent = dueCards.length;
        }

        const newCountEl = document.getElementById('new-cards-count');
        if (newCountEl) {
            newCountEl.textContent = newCards.length;
        }

        const reviewCountEl = document.getElementById('review-cards-count');
        if (reviewCountEl) {
            reviewCountEl.textContent = reviewCards.length;
        }
    }

    migrateCardsSR() {
        // Add SR data to existing cards that don't have it
        let migrated = false;
        Object.values(this.data.folders).forEach(folder => {
            folder.sets.forEach(set => {
                set.cards.forEach(card => {
                    if (!card.sr) {
                        card.sr = this.getDefaultSRData();
                        migrated = true;
                    }
                });
            });
        });
        if (migrated) this.saveData();
    }

    // ========================================
    // STREAK SYSTEM
    // ========================================

    getDefaultStreakData() {
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastActivityDate: null,
            totalActiveDays: 0
        };
    }

    loadStreakData() {
        const saved = localStorage.getItem("streakData");
        if (saved) {
            this.streakData = JSON.parse(saved);
        } else {
            this.streakData = this.getDefaultStreakData();
        }
    }

    saveStreakData() {
        localStorage.setItem("streakData", JSON.stringify(this.streakData));
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    getYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    updateStreak() {
        const today = this.getTodayDate();
        const lastActivity = this.streakData.lastActivityDate;

        // Already studied today
        if (lastActivity === today) {
            return;
        }

        // Check if streak continues or resets
        if (lastActivity === this.getYesterdayDate()) {
            // Studied yesterday - continue streak
            this.streakData.currentStreak++;
        } else {
            // Streak broken - restart at 1
            this.streakData.currentStreak = 1;
        }

        // Update longest streak if needed
        if (this.streakData.currentStreak > this.streakData.longestStreak) {
            this.streakData.longestStreak = this.streakData.currentStreak;
        }

        // Update tracking
        this.streakData.lastActivityDate = today;
        this.streakData.totalActiveDays++;

        this.saveStreakData();
        this.updateStreakUI();
    }

    updateStreakUI() {
        const widget = document.getElementById('streak-widget');
        const countEl = document.getElementById('streak-count');

        if (!widget || !countEl) return;

        countEl.textContent = this.streakData.currentStreak;

        const today = this.getTodayDate();
        const isActiveToday = this.streakData.lastActivityDate === today;

        widget.classList.remove('active', 'inactive');
        if (isActiveToday) {
            widget.classList.add('active');
        } else if (this.streakData.currentStreak > 0) {
            widget.classList.add('inactive');
        }
    }

    getDefaultData() {
        return { folders: {
            german: { name: "German", flag: "de", sets: [
                { id: this.generateId(), name: "Common Phrases", description: "Essential German phrases", cards: [
                    { id: this.generateId(), front: "Guten Morgen", back: "Good morning", example: "Guten Morgen! Wie geht es Ihnen?", starred: false },
                    { id: this.generateId(), front: "Guten Tag", back: "Good day / Hello", example: "Guten Tag, ich bin Anna.", starred: false },
                    { id: this.generateId(), front: "Auf Wiedersehen", back: "Goodbye", example: "Auf Wiedersehen! Bis morgen!", starred: false },
                    { id: this.generateId(), front: "Danke schön", back: "Thank you very much", example: "Danke schön für Ihre Hilfe!", starred: false },
                    { id: this.generateId(), front: "Bitte", back: "Please / You are welcome", example: "Ein Kaffee, bitte.", starred: false },
                    { id: this.generateId(), front: "Entschuldigung", back: "Excuse me / Sorry", example: "Entschuldigung, wo ist der Bahnhof?", starred: false },
                    { id: this.generateId(), front: "Wie geht es dir?", back: "How are you? (informal)", example: "Hallo! Wie geht es dir heute?", starred: false },
                    { id: this.generateId(), front: "Mir geht es gut", back: "I am doing well", example: "Danke, mir geht es gut!", starred: false }
                ]},
                { id: this.generateId(), name: "Questions & Answers", description: "Common German questions", cards: [
                    { id: this.generateId(), front: "Ich heiße...", back: "My name is...", example: "Ich heiße Thomas. Und du?", starred: false },
                    { id: this.generateId(), front: "Was kostet das?", back: "How much does this cost?", example: "Was kostet das T-Shirt?", starred: false },
                    { id: this.generateId(), front: "Wo ist...?", back: "Where is...?", example: "Wo ist die Toilette, bitte?", starred: false },
                    { id: this.generateId(), front: "Ich möchte...", back: "I would like...", example: "Ich möchte einen Kaffee, bitte.", starred: false },
                    { id: this.generateId(), front: "Prost!", back: "Cheers!", example: "Auf deine Gesundheit! Prost!", starred: false }
                ]}
            ]},
            russian: { name: "Russian", flag: "ru", sets: [
                { id: this.generateId(), name: "Basic Greetings", description: "Essential Russian greetings", cards: [
                    { id: this.generateId(), front: "Привет", back: "Hello (informal)", example: "Привет! Как дела?", starred: false },
                    { id: this.generateId(), front: "Здравствуйте", back: "Hello (formal)", example: "Здравствуйте, меня зовут Анна.", starred: false },
                    { id: this.generateId(), front: "До свидания", back: "Goodbye", example: "До свидания! Было приятно!", starred: false },
                    { id: this.generateId(), front: "Спасибо", back: "Thank you", example: "Спасибо за помощь!", starred: false },
                    { id: this.generateId(), front: "Пожалуйста", back: "Please / You are welcome", example: "Воды, пожалуйста.", starred: false },
                    { id: this.generateId(), front: "Как дела?", back: "How are you?", example: "Привет! Как дела?", starred: false },
                    { id: this.generateId(), front: "Хорошо", back: "Good / Well", example: "У меня всё хорошо!", starred: false }
                ]},
                { id: this.generateId(), name: "Useful Expressions", description: "Common Russian expressions", cards: [
                    { id: this.generateId(), front: "Меня зовут...", back: "My name is...", example: "Меня зовут Иван. А вас?", starred: false },
                    { id: this.generateId(), front: "Да", back: "Yes", example: "Да, я понимаю.", starred: false },
                    { id: this.generateId(), front: "Нет", back: "No", example: "Нет, спасибо.", starred: false },
                    { id: this.generateId(), front: "Доброе утро", back: "Good morning", example: "Доброе утро! Как спали?", starred: false },
                    { id: this.generateId(), front: "Спокойной ночи", back: "Good night", example: "Спокойной ночи! Сладких снов!", starred: false }
                ]}
            ]},
            english: { name: "English", flag: "gb", sets: [
                { id: this.generateId(), name: "Advanced Vocabulary", description: "Sophisticated English vocabulary", cards: [
                    { id: this.generateId(), front: "Serendipity", back: "The occurrence of events by chance in a happy way", example: "Finding that book was pure serendipity.", starred: false },
                    { id: this.generateId(), front: "Ephemeral", back: "Lasting for a very short time", example: "The ephemeral beauty of cherry blossoms.", starred: false },
                    { id: this.generateId(), front: "Ubiquitous", back: "Present, appearing, or found everywhere", example: "Smartphones have become ubiquitous.", starred: false },
                    { id: this.generateId(), front: "Eloquent", back: "Fluent or persuasive in speaking or writing", example: "She gave an eloquent speech.", starred: false },
                    { id: this.generateId(), front: "Resilient", back: "Able to recover quickly from difficulties", example: "Children are remarkably resilient.", starred: false },
                    { id: this.generateId(), front: "Pragmatic", back: "Dealing with things sensibly and realistically", example: "We need a pragmatic approach.", starred: false }
                ]},
                { id: this.generateId(), name: "Character Traits", description: "Words to describe personality", cards: [
                    { id: this.generateId(), front: "Benevolent", back: "Well-meaning and kindly", example: "A benevolent smile crossed her face.", starred: false },
                    { id: this.generateId(), front: "Candid", back: "Truthful and straightforward", example: "Let me be candid with you.", starred: false },
                    { id: this.generateId(), front: "Diligent", back: "Having or showing care in work", example: "She is a diligent student.", starred: false },
                    { id: this.generateId(), front: "Empathy", back: "The ability to understand others feelings", example: "She showed great empathy.", starred: false },
                    { id: this.generateId(), front: "Inevitable", back: "Certain to happen; unavoidable", example: "Change is inevitable.", starred: false }
                ]}
            ]}
        }};
    }

    loadData() {
        const savedData = localStorage.getItem("flashcardFolders");
        if (savedData) { this.data = JSON.parse(savedData); this.migrateFlags(); }
        else { this.data = this.getDefaultData(); this.saveData(); }
        const savedOrder = localStorage.getItem("folderOrder");
        if (savedOrder) { this.folderOrder = JSON.parse(savedOrder); }
        else { this.folderOrder = Object.keys(this.data.folders); }
    }

    migrateFlags() {
        const emojiToCode = { "🇩🇪": "de", "🇷🇺": "ru", "🇬🇧": "gb", "🇫🇷": "fr", "🇪🇸": "es", "🇮🇹": "it", "🇵🇹": "pt", "🇳🇱": "nl", "🇵🇱": "pl", "🇯🇵": "jp", "🇨🇳": "cn", "🇰🇷": "kr", "🇻🇳": "vn", "🇹🇭": "th", "🇮🇩": "id", "🇸🇦": "ar", "🇹🇷": "tr", "🇬🇷": "gr", "🇸🇪": "se", "🇳🇴": "no", "🇩🇰": "dk", "🇫🇮": "fi", "🇨🇿": "cz", "🇭🇺": "hu", "🇷🇴": "ro", "🇺🇦": "ua", "🇮🇳": "in", "🇮🇱": "il", "🇮🇷": "ir", "🇵🇰": "pk" };
        let migrated = false;
        Object.values(this.data.folders).forEach(folder => {
            if (emojiToCode[folder.flag]) { folder.flag = emojiToCode[folder.flag]; migrated = true; }
        });
        if (migrated) this.saveData();
    }
    saveData() { localStorage.setItem("flashcardFolders", JSON.stringify(this.data)); }
    saveFolderOrder() { localStorage.setItem("folderOrder", JSON.stringify(this.folderOrder)); }

    bindEvents() {
        document.getElementById("home-btn").addEventListener("click", (e) => { e.preventDefault(); this.showLibrary(); });
        document.getElementById("create-language-btn").addEventListener("click", () => this.showLanguageModal());
        document.getElementById("back-to-library").addEventListener("click", () => this.showLibrary());
        document.getElementById("back-to-folder").addEventListener("click", () => this.showFolder(this.currentFolder));
        document.getElementById("add-set-btn").addEventListener("click", () => this.showSetModal());
        document.getElementById("empty-add-set-btn").addEventListener("click", () => this.showSetModal());
        document.getElementById("set-modal-close").addEventListener("click", () => this.hideSetModal());
        document.getElementById("set-modal-cancel").addEventListener("click", () => this.hideSetModal());
        document.getElementById("set-modal-save").addEventListener("click", () => this.saveSet());
        document.querySelector("#set-modal .modal-overlay").addEventListener("click", () => this.hideSetModal());
        document.getElementById("card-modal-close").addEventListener("click", () => this.hideCardModal());
        document.getElementById("card-modal-cancel").addEventListener("click", () => this.hideCardModal());
        document.getElementById("card-modal-save").addEventListener("click", () => this.saveCard());
        document.querySelector("#card-modal .modal-overlay").addEventListener("click", () => this.hideCardModal());
        document.getElementById("image-upload-area").addEventListener("click", () => document.getElementById("image-input").click());
        document.getElementById("image-input").addEventListener("change", (e) => this.handleImageUpload(e));
        document.getElementById("remove-image-btn").addEventListener("click", (e) => { e.stopPropagation(); this.removeImage(); });
        document.getElementById("image-upload-area").addEventListener("dragover", (e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); });
        document.getElementById("image-upload-area").addEventListener("dragleave", (e) => { e.currentTarget.classList.remove("drag-over"); });
        document.getElementById("image-upload-area").addEventListener("drop", (e) => this.handleImageDrop(e));
        // Spaced Repetition review buttons
        document.getElementById("sr-again-btn").addEventListener("click", () => this.reviewCard(0));
        document.getElementById("sr-hard-btn").addEventListener("click", () => this.reviewCard(1));
        document.getElementById("sr-good-btn").addEventListener("click", () => this.reviewCard(2));
        document.getElementById("sr-easy-btn").addEventListener("click", () => this.reviewCard(3));
        document.getElementById("reset-progress-btn").addEventListener("click", () => this.resetProgress());
        document.getElementById("import-btn").addEventListener("click", () => this.showImportModal());
        document.getElementById("import-close").addEventListener("click", () => this.hideImportModal());
        document.getElementById("import-cancel").addEventListener("click", () => this.hideImportModal());
        document.getElementById("import-confirm").addEventListener("click", () => this.importCards());
        document.querySelector("#import-modal .modal-overlay").addEventListener("click", () => this.hideImportModal());
        document.getElementById("edit-set-btn").addEventListener("click", () => this.showSetModal(this.getCurrentSetObject()));
        document.getElementById("delete-set-btn").addEventListener("click", () => this.deleteCurrentSet());
        document.getElementById("add-term-btn").addEventListener("click", () => this.showCardModal());
        document.querySelectorAll(".mode-card").forEach(card => { card.addEventListener("click", (e) => this.switchMode(e.currentTarget.dataset.mode)); });
        document.getElementById("flashcard").addEventListener("click", () => this.flipCard());
        document.getElementById("prev-btn").addEventListener("click", () => this.previousCard());
        document.getElementById("next-btn").addEventListener("click", () => this.nextCard());
        document.getElementById("shuffle-btn").addEventListener("click", () => this.toggleShuffle());
        document.getElementById("fullscreen-btn").addEventListener("click", () => this.toggleFullscreen());
        document.getElementById("front-tts-btn").addEventListener("click", (e) => { e.stopPropagation(); this.speakFront(); });
        document.getElementById("back-tts-btn").addEventListener("click", (e) => { e.stopPropagation(); this.speakBack(); });
        document.getElementById("continue-btn").addEventListener("click", () => this.nextLearnQuestion());
        document.getElementById("submit-test-btn").addEventListener("click", () => this.submitTest());
        document.getElementById("retake-btn").addEventListener("click", () => this.startTestMode());
        document.getElementById("play-again-btn").addEventListener("click", () => this.startMatchMode());
        document.getElementById("library-settings-btn").addEventListener("click", () => this.showSettingsModal());
        document.getElementById("settings-modal-close").addEventListener("click", () => this.hideSettingsModal());
        document.getElementById("settings-modal-cancel").addEventListener("click", () => this.hideSettingsModal());
        document.getElementById("settings-modal-save").addEventListener("click", () => this.saveSettings());
        document.querySelector("#settings-modal .modal-overlay").addEventListener("click", () => this.hideSettingsModal());
        document.getElementById("language-modal-close").addEventListener("click", () => this.hideLanguageModal());
        document.getElementById("language-modal-cancel").addEventListener("click", () => this.hideLanguageModal());
        document.getElementById("language-modal-save").addEventListener("click", () => this.saveLanguage());
        document.querySelector("#language-modal .modal-overlay").addEventListener("click", () => this.hideLanguageModal());
        document.addEventListener("keydown", (e) => this.handleKeyboard(e));
        // Auth events
        document.getElementById("login-btn")?.addEventListener("click", () => this.showAuthModal('login'));
        document.getElementById("auth-modal-close")?.addEventListener("click", () => this.hideAuthModal());
        document.querySelector("#auth-modal .modal-overlay")?.addEventListener("click", () => this.hideAuthModal());
        document.getElementById("auth-switch-btn")?.addEventListener("click", () => this.toggleAuthMode());
        document.getElementById("auth-form")?.addEventListener("submit", (e) => { e.preventDefault(); this.handleAuth(); });
        document.getElementById("auth-submit")?.addEventListener("click", () => this.handleAuth());
        document.getElementById("user-btn")?.addEventListener("click", () => this.toggleUserDropdown());
        document.getElementById("logout-btn")?.addEventListener("click", () => this.handleLogout());
    }

    showLibrary() {
        this.currentFolder = null; this.currentSet = null;
        document.getElementById("create-language-btn").classList.remove("hidden");
        document.getElementById("library-view").classList.remove("hidden");
        document.getElementById("folder-view").classList.add("hidden");
        document.getElementById("set-view").classList.add("hidden");
        this.renderFolders();
        this.updateLibraryCounts();
    }

    renderFolders() {
        const foldersGrid = document.querySelector(".folders-grid");
        foldersGrid.innerHTML = "";
        this.folderOrder.forEach(folderId => {
            const folder = this.data.folders[folderId];
            if (!folder) return;
            const folderCard = document.createElement("div");
            folderCard.className = "folder-card";
            folderCard.dataset.folder = folderId;
            const flagContent = this.isCountryCode(folder.flag) ? `<img src="${this.getFlagUrl(folder.flag)}" alt="${folder.name}" class="folder-flag-img">` : `<span>${folder.flag}</span>`;
            folderCard.innerHTML = `
                <div class="folder-icon">${flagContent}</div>
                <div class="folder-info">
                    <h3>${folder.name}</h3>
                    <p><span id="${folderId}-sets-count">0</span> sets · <span id="${folderId}-cards-count">0</span> cards</p>
                </div>
                <svg class="folder-arrow" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            `;
            folderCard.addEventListener("click", () => this.showFolder(folderId));
            foldersGrid.appendChild(folderCard);
        });
    }

    showSettingsModal() {
        document.getElementById("settings-modal").classList.add("active");
        this.tempFolderOrder = [...this.folderOrder];
        this.renderLanguageOrderList();
    }

    hideSettingsModal() {
        document.getElementById("settings-modal").classList.remove("active");
        this.tempFolderOrder = [];
    }

    renderLanguageOrderList() {
        const list = document.getElementById("language-order-list");
        list.innerHTML = "";
        this.tempFolderOrder.forEach((folderId, index) => {
            const folder = this.data.folders[folderId];
            if (!folder) return;
            const item = document.createElement("div");
            item.className = "language-order-item";
            item.draggable = true;
            item.dataset.folderId = folderId;
            const flagHtml = this.isCountryCode(folder.flag) ? `<img src="${this.getFlagUrl(folder.flag)}" alt="${folder.name}" class="language-order-flag-img">` : folder.flag;
            item.innerHTML = `
                <div class="drag-handle">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                    </svg>
                </div>
                <div class="language-order-flag">${flagHtml}</div>
                <div class="language-order-name">${folder.name}</div>
                <div class="language-order-actions">
                    <button class="order-btn move-up" ${index === 0 ? 'disabled' : ''} title="Move up">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"/>
                        </svg>
                    </button>
                    <button class="order-btn move-down" ${index === this.tempFolderOrder.length - 1 ? 'disabled' : ''} title="Move down">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                </div>
            `;
            item.querySelector(".move-up").addEventListener("click", () => this.moveLanguage(index, -1));
            item.querySelector(".move-down").addEventListener("click", () => this.moveLanguage(index, 1));
            item.addEventListener("dragstart", (e) => this.handleDragStart(e, index));
            item.addEventListener("dragend", () => this.handleDragEnd());
            item.addEventListener("dragover", (e) => this.handleDragOver(e));
            item.addEventListener("drop", (e) => this.handleDrop(e, index));
            list.appendChild(item);
        });
    }

    moveLanguage(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.tempFolderOrder.length) return;
        [this.tempFolderOrder[index], this.tempFolderOrder[newIndex]] = [this.tempFolderOrder[newIndex], this.tempFolderOrder[index]];
        this.renderLanguageOrderList();
    }

    handleDragStart(e, index) {
        this.draggedItem = index;
        e.target.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
    }

    handleDragEnd() {
        this.draggedItem = null;
        document.querySelectorAll(".language-order-item").forEach(item => {
            item.classList.remove("dragging", "drag-over");
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const item = e.target.closest(".language-order-item");
        if (item && !item.classList.contains("dragging")) {
            document.querySelectorAll(".language-order-item").forEach(i => i.classList.remove("drag-over"));
            item.classList.add("drag-over");
        }
    }

    handleDrop(e, targetIndex) {
        e.preventDefault();
        if (this.draggedItem === null || this.draggedItem === targetIndex) return;
        const draggedFolderId = this.tempFolderOrder[this.draggedItem];
        this.tempFolderOrder.splice(this.draggedItem, 1);
        this.tempFolderOrder.splice(targetIndex, 0, draggedFolderId);
        this.renderLanguageOrderList();
    }

    saveSettings() {
        this.folderOrder = [...this.tempFolderOrder];
        this.saveFolderOrder();
        this.hideSettingsModal();
        this.renderFolders();
        this.updateLibraryCounts();
    }

    showLanguageModal() {
        document.getElementById("language-modal").classList.add("active");
        this.selectedCountry = null;
        this.renderLanguageGrid();
    }

    hideLanguageModal() {
        document.getElementById("language-modal").classList.remove("active");
        this.selectedCountry = null;
    }

    renderLanguageGrid() {
        const grid = document.getElementById("language-grid");
        grid.innerHTML = "";
        const existingFlags = Object.values(this.data.folders).map(f => f.flag);
        this.countries.forEach(country => {
            const isUsed = existingFlags.includes(country.code);
            const item = document.createElement("div");
            item.className = `language-option${isUsed ? " used" : ""}`;
            item.dataset.code = country.code;
            item.dataset.name = country.name;
            item.innerHTML = `<img src="${this.getFlagUrl(country.code)}" alt="${country.name}"><span>${country.name}</span>`;
            if (!isUsed) {
                item.addEventListener("click", () => this.selectCountry(country, item));
            }
            grid.appendChild(item);
        });
    }

    selectCountry(country, element) {
        document.querySelectorAll(".language-option.selected").forEach(el => el.classList.remove("selected"));
        element.classList.add("selected");
        this.selectedCountry = country;
    }

    saveLanguage() {
        if (!this.selectedCountry) { alert("Please select a language."); return; }
        const folderId = this.selectedCountry.name.toLowerCase().replace(/\s+/g, "-");
        if (this.data.folders[folderId]) { alert("This language already exists."); return; }
        this.data.folders[folderId] = { name: this.selectedCountry.name, flag: this.selectedCountry.code, sets: [] };
        this.folderOrder.push(folderId);
        this.saveData();
        this.saveFolderOrder();
        this.hideLanguageModal();
        this.renderFolders();
        this.updateLibraryCounts();
    }

    showFolder(folderId) {
        this.currentFolder = folderId; this.currentSet = null;
        const folder = this.data.folders[folderId];
        if (!folder) return;
        document.getElementById("create-language-btn").classList.add("hidden");
        document.getElementById("library-view").classList.add("hidden");
        document.getElementById("folder-view").classList.remove("hidden");
        document.getElementById("set-view").classList.add("hidden");
        document.getElementById("folder-name").textContent = folder.name;
        const titleIcon = document.getElementById("folder-title-icon");
        if (this.isCountryCode(folder.flag)) {
            titleIcon.innerHTML = `<img src="${this.getFlagUrl(folder.flag)}" alt="${folder.name}" class="folder-flag-img">`;
        } else {
            titleIcon.textContent = folder.flag;
        }
        document.getElementById("folder-title-text").textContent = folder.name;
        document.getElementById("set-language-select").value = folderId;
        this.renderSetsList();
    }

    showSet(setId) {
        const folder = this.data.folders[this.currentFolder];
        const set = folder.sets.find(s => s.id === setId);
        if (!set) return;
        this.currentSet = setId; this.currentCards = set.cards;
        document.getElementById("create-language-btn").classList.add("hidden");
        document.getElementById("library-view").classList.add("hidden");
        document.getElementById("folder-view").classList.add("hidden");
        document.getElementById("set-view").classList.remove("hidden");
        document.getElementById("breadcrumb-folder-name").textContent = folder.name;
        document.getElementById("breadcrumb-set-name").textContent = set.name;
        document.getElementById("set-title").textContent = set.name;
        document.getElementById("term-count").textContent = set.cards.length + " terms";
        this.currentMode = "flashcards";
        document.querySelectorAll(".mode-card").forEach(card => { card.classList.toggle("active", card.dataset.mode === "flashcards"); });
        document.getElementById("flashcard-section").classList.remove("hidden");
        document.getElementById("learn-section").classList.add("hidden");
        document.getElementById("test-section").classList.add("hidden");
        document.getElementById("match-section").classList.add("hidden");
        this.updateSetUI();
    }

    updateLibraryCounts() {
        Object.keys(this.data.folders).forEach(folderId => {
            const folder = this.data.folders[folderId];
            const setsCount = folder.sets.length;
            const cardsCount = folder.sets.reduce((sum, set) => sum + set.cards.length, 0);
            document.getElementById(folderId + "-sets-count").textContent = setsCount;
            document.getElementById(folderId + "-cards-count").textContent = cardsCount;
        });
    }

    renderSetsList() {
        const folder = this.data.folders[this.currentFolder];
        const setsGrid = document.getElementById("sets-grid");
        const emptyFolder = document.getElementById("empty-folder");
        setsGrid.innerHTML = "";
        if (folder.sets.length === 0) { setsGrid.classList.add("hidden"); emptyFolder.classList.remove("hidden"); return; }
        setsGrid.classList.remove("hidden"); emptyFolder.classList.add("hidden");
        folder.sets.forEach(set => {
            const setCard = document.createElement("div"); setCard.className = "set-card";
            setCard.innerHTML = "<div class=\"set-card-header\"><h3>" + this.escapeHtml(set.name) + "</h3><span class=\"set-card-count\">" + set.cards.length + " terms</span></div><p class=\"set-card-description\">" + this.escapeHtml(set.description || "No description") + "</p><div class=\"set-card-footer\"><span class=\"set-card-preview\">" + (set.cards.slice(0, 3).map(c => this.escapeHtml(c.front)).join(" • ") || "No terms yet") + "</span></div>";
            setCard.addEventListener("click", () => this.showSet(set.id));
            setsGrid.appendChild(setCard);
        });
    }

    showSetModal(set = null) {
        document.getElementById("set-modal").classList.add("active");
        if (set) {
            document.getElementById("set-modal-title").textContent = "Edit set";
            document.getElementById("set-modal-save").textContent = "Save Changes";
            this.editingSetId = set.id;
            document.getElementById("set-language-select").value = this.currentFolder || "german";
            document.getElementById("set-name-input").value = set.name;
            document.getElementById("set-description-input").value = set.description || "";
        } else {
            document.getElementById("set-modal-title").textContent = "Create new set";
            document.getElementById("set-modal-save").textContent = "Create Set";
            this.editingSetId = null;
            document.getElementById("set-language-select").value = this.currentFolder || "german";
            document.getElementById("set-name-input").value = "";
            document.getElementById("set-description-input").value = "";
        }
        document.getElementById("set-name-input").focus();
    }
    hideSetModal() { document.getElementById("set-modal").classList.remove("active"); this.editingSetId = null; }

    saveSet() {
        const folderId = document.getElementById("set-language-select").value;
        const name = document.getElementById("set-name-input").value.trim();
        const description = document.getElementById("set-description-input").value.trim();
        if (!name) { alert("Please enter a set name."); return; }
        const folder = this.data.folders[folderId];
        if (this.editingSetId) {
            Object.keys(this.data.folders).forEach(fId => {
                const idx = this.data.folders[fId].sets.findIndex(s => s.id === this.editingSetId);
                if (idx !== -1) {
                    if (fId === folderId) { this.data.folders[fId].sets[idx].name = name; this.data.folders[fId].sets[idx].description = description; }
                    else { const [movedSet] = this.data.folders[fId].sets.splice(idx, 1); movedSet.name = name; movedSet.description = description; folder.sets.push(movedSet); this.currentFolder = folderId; }
                }
            });
        } else { folder.sets.push({ id: this.generateId(), name, description, cards: [] }); this.currentFolder = folderId; }
        this.saveData(); this.hideSetModal(); this.updateLibraryCounts();
        if (this.currentFolder) { this.showFolder(this.currentFolder); }
    }

    getCurrentSetObject() {
        if (!this.currentFolder || !this.currentSet) return null;
        return this.data.folders[this.currentFolder].sets.find(s => s.id === this.currentSet);
    }

    deleteCurrentSet() {
        if (!confirm("Are you sure you want to delete this set and all its cards?")) return;
        const folder = this.data.folders[this.currentFolder];
        const idx = folder.sets.findIndex(s => s.id === this.currentSet);
        if (idx !== -1) { folder.sets.splice(idx, 1); this.saveData(); this.showFolder(this.currentFolder); }
    }

    showCardModal(card = null) {
        document.getElementById("card-modal").classList.add("active");
        if (card) {
            document.getElementById("card-modal-title").textContent = "Edit term"; this.editingCardId = card.id;
            document.getElementById("term-input").value = card.front;
            document.getElementById("definition-input").value = card.back;
            document.getElementById("example-input").value = card.example || "";
            if (card.image) {
                this.currentImageData = card.image;
                this.showImagePreview(card.image);
            } else {
                this.currentImageData = null;
                this.hideImagePreview();
            }
        } else {
            document.getElementById("card-modal-title").textContent = "Add new term"; this.editingCardId = null;
            document.getElementById("term-input").value = "";
            document.getElementById("definition-input").value = "";
            document.getElementById("example-input").value = "";
            this.currentImageData = null;
            this.hideImagePreview();
        }
        document.getElementById("term-input").focus();
    }
    hideCardModal() {
        document.getElementById("card-modal").classList.remove("active");
        this.editingCardId = null;
        this.currentImageData = null;
        this.hideImagePreview();
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) this.processImageFile(file);
    }

    handleImageDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) this.processImageFile(file);
    }

    processImageFile(file) {
        if (file.size > 2 * 1024 * 1024) {
            alert("Image size should be less than 2MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImageData = e.target.result;
            this.showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    showImagePreview(src) {
        document.getElementById("image-preview").src = src;
        document.getElementById("image-preview-container").classList.remove("hidden");
        document.getElementById("image-upload-placeholder").classList.add("hidden");
    }

    hideImagePreview() {
        document.getElementById("image-preview").src = "";
        document.getElementById("image-preview-container").classList.add("hidden");
        document.getElementById("image-upload-placeholder").classList.remove("hidden");
        document.getElementById("image-input").value = "";
    }

    removeImage() {
        this.currentImageData = null;
        this.hideImagePreview();
    }

    saveCard() {
        const front = document.getElementById("term-input").value.trim();
        const back = document.getElementById("definition-input").value.trim();
        const example = document.getElementById("example-input").value.trim();
        if (!front || !back) { alert("Please fill in both the term and definition."); return; }
        const set = this.getCurrentSetObject(); if (!set) return;
        if (this.editingCardId) {
            const card = set.cards.find(c => c.id === this.editingCardId);
            if (card) {
                card.front = front;
                card.back = back;
                card.example = example;
                card.image = this.currentImageData;
            }
        } else {
            set.cards.push({
                id: this.generateId(),
                front,
                back,
                example,
                image: this.currentImageData,
                starred: false,
                mastery: "not-started"
            });
        }
        this.saveData(); this.hideCardModal(); this.currentCards = set.cards; this.updateSetUI();
    }

    deleteCard(id) {
        if (!confirm("Are you sure you want to delete this term?")) return;
        const set = this.getCurrentSetObject(); if (!set) return;
        const idx = set.cards.findIndex(c => c.id === id);
        if (idx !== -1) { set.cards.splice(idx, 1); this.saveData(); this.currentCards = set.cards; this.updateSetUI(); }
    }

    toggleStar(id) {
        const set = this.getCurrentSetObject(); if (!set) return;
        const card = set.cards.find(c => c.id === id);
        if (card) { card.starred = !card.starred; this.saveData(); this.renderTermsList(); }
    }

    showImportModal() { document.getElementById("import-modal").classList.add("active"); document.getElementById("import-data").value = ""; }
    hideImportModal() { document.getElementById("import-modal").classList.remove("active"); }

    importCards() {
        const data = document.getElementById("import-data").value.trim();
        const separator = document.getElementById("separator-select").value;
        if (!data) { alert("Please enter some data to import."); return; }
        const set = this.getCurrentSetObject(); if (!set) return;
        const sepChar = separator === "tab" ? "\t" : separator === "comma" ? "," : ";";
        const lines = data.split("\n"); let imported = 0;
        lines.forEach(line => {
            const parts = line.split(sepChar);
            if (parts.length >= 2) { set.cards.push({ id: this.generateId(), front: parts[0].trim(), back: parts[1].trim(), example: parts[2] ? parts[2].trim() : "", starred: false }); imported++; }
        });
        if (imported > 0) { this.saveData(); this.hideImportModal(); this.currentCards = set.cards; this.updateSetUI(); alert("Successfully imported " + imported + " terms!"); }
        else { alert("No valid terms found."); }
    }

    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll(".mode-card").forEach(card => { card.classList.toggle("active", card.dataset.mode === mode); });
        document.getElementById("flashcard-section").classList.add("hidden");
        document.getElementById("learn-section").classList.add("hidden");
        document.getElementById("test-section").classList.add("hidden");
        document.getElementById("match-section").classList.add("hidden");
        switch (mode) {
            case "flashcards": document.getElementById("flashcard-section").classList.remove("hidden"); this.prepareStudyCards(); break;
            case "learn": document.getElementById("learn-section").classList.remove("hidden"); this.startLearnMode(); break;
            case "test": document.getElementById("test-section").classList.remove("hidden"); this.startTestMode(); break;
            case "match": document.getElementById("match-section").classList.remove("hidden"); this.startMatchMode(); break;
        }
    }

    updateSetUI() {
        const set = this.getCurrentSetObject(); if (!set) return;
        document.getElementById("term-count").textContent = set.cards.length + " terms";
        document.getElementById("terms-count").textContent = set.cards.length;
        this.renderTermsList();
        this.prepareStudyCards();
        this.updateProgressTracking();
    }

    prepareStudyCards() {
        let cards = [...this.currentCards];
        if (this.isShuffled) { cards = this.shuffleArray(cards); }
        this.studyCards = cards; this.currentIndex = 0; this.updateFlashcard();
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; }
        return newArray;
    }

    flipCard() { document.getElementById("flashcard").classList.toggle("flipped"); }
    previousCard() { if (this.currentIndex > 0) { this.currentIndex--; this.updateFlashcard(); } }
    nextCard() { if (this.currentIndex < this.studyCards.length - 1) { this.currentIndex++; this.updateFlashcard(); } }

    updateFlashcard() {
        const flashcard = document.getElementById("flashcard"); flashcard.classList.remove("flipped");
        const imageContainer = document.getElementById("card-image-container");
        const cardImage = document.getElementById("card-image");
        if (this.studyCards.length === 0) {
            document.getElementById("front-content").textContent = "No cards available";
            document.getElementById("back-content").textContent = "Add some cards to start studying";
            document.getElementById("example-text").textContent = "";
            document.getElementById("current-card").textContent = "0";
            document.getElementById("total-cards").textContent = "0";
            document.getElementById("progress-fill").style.width = "0%";
            imageContainer.classList.add("hidden");
            this.updateMasteryButtons(null);
            return;
        }
        const card = this.studyCards[this.currentIndex];
        if (this.showTermFirst) {
            document.getElementById("front-content").textContent = card.front;
            document.getElementById("back-content").textContent = card.back;
            document.querySelector(".flashcard-front .card-label").textContent = "TERM";
            document.querySelector(".flashcard-back .card-label").textContent = "DEFINITION";
        } else {
            document.getElementById("front-content").textContent = card.back;
            document.getElementById("back-content").textContent = card.front;
            document.querySelector(".flashcard-front .card-label").textContent = "DEFINITION";
            document.querySelector(".flashcard-back .card-label").textContent = "TERM";
        }
        if (card.image) {
            cardImage.src = card.image;
            imageContainer.classList.remove("hidden");
        } else {
            imageContainer.classList.add("hidden");
        }
        document.getElementById("example-text").textContent = card.example || "";
        document.getElementById("current-card").textContent = this.currentIndex + 1;
        document.getElementById("total-cards").textContent = this.studyCards.length;
        const progress = ((this.currentIndex + 1) / this.studyCards.length) * 100;
        document.getElementById("progress-fill").style.width = progress + "%";
        this.updateSRIntervals(card);
    }

    formatInterval(days) {
        if (days === 0) return "<10m";
        if (days === 1) return "1d";
        if (days < 7) return days + "d";
        if (days < 30) return Math.round(days / 7) + "w";
        if (days < 365) return Math.round(days / 30) + "mo";
        return Math.round(days / 365) + "y";
    }

    updateSRIntervals(card) {
        if (!card) return;

        // Calculate what intervals would be for each choice
        const sr = card.sr || this.getDefaultSRData();

        // Again: always shows <1m (review again this session)
        // Hard, Good, Easy: calculate based on current state
        let hardInterval, goodInterval, easyInterval;

        if (sr.repetitions === 0) {
            // First review: 10min, 1d, 2d
            hardInterval = 0;
            goodInterval = 1;
            easyInterval = 2;
        } else if (sr.repetitions === 1) {
            // Second review: 1d, 2d, 4d
            hardInterval = 1;
            goodInterval = 2;
            easyInterval = 4;
        } else if (sr.repetitions === 2) {
            // Third review: 3d, 5d, 7d
            hardInterval = 3;
            goodInterval = 5;
            easyInterval = 7;
        } else {
            // Later reviews: use ease factor
            const baseInterval = Math.round(sr.interval * sr.easeFactor);
            hardInterval = Math.max(1, Math.round(baseInterval * 0.7));
            goodInterval = baseInterval;
            easyInterval = Math.round(baseInterval * 1.2);
        }

        document.getElementById("sr-hard-interval").textContent = this.formatInterval(hardInterval);
        document.getElementById("sr-good-interval").textContent = this.formatInterval(goodInterval);
        document.getElementById("sr-easy-interval").textContent = this.formatInterval(easyInterval);
    }


    updateProgressTracking() {
        const set = this.getCurrentSetObject();
        if (!set) return;
        const total = set.cards.length;
        if (total === 0) {
            document.getElementById("mastered-count").textContent = "0";
            document.getElementById("learning-count").textContent = "0";
            document.getElementById("not-started-count").textContent = "0";
            document.getElementById("progress-bar-mastered").style.width = "0%";
            document.getElementById("progress-bar-learning").style.width = "0%";
            document.getElementById("progress-percentage").textContent = "0% complete";
            return;
        }
        let mastered = 0, learning = 0, notStarted = 0;
        set.cards.forEach(card => {
            if (card.mastery === "mastered") mastered++;
            else if (card.mastery === "learning") learning++;
            else notStarted++;
        });
        document.getElementById("mastered-count").textContent = mastered;
        document.getElementById("learning-count").textContent = learning;
        document.getElementById("not-started-count").textContent = notStarted;
        const masteredPercent = (mastered / total) * 100;
        const learningPercent = (learning / total) * 100;
        document.getElementById("progress-bar-mastered").style.width = masteredPercent + "%";
        document.getElementById("progress-bar-learning").style.width = learningPercent + "%";
        const completePercent = Math.round(masteredPercent);
        document.getElementById("progress-percentage").textContent = completePercent + "% complete";
    }

    resetProgress() {
        if (!confirm("Are you sure you want to reset your progress for this set?")) return;
        const set = this.getCurrentSetObject();
        if (!set) return;
        set.cards.forEach(card => { card.mastery = "not-started"; });
        this.saveData();
        this.updateProgressTracking();
        this.updateFlashcard();
    }

    toggleShuffle() { this.isShuffled = !this.isShuffled; document.getElementById("shuffle-btn").classList.toggle("active", this.isShuffled); this.prepareStudyCards(); }
    toggleFullscreen() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); } else { document.exitFullscreen(); } }

    getLanguageCode(folderId) {
        const langMap = { german: "de-DE", russian: "ru-RU", english: "en-US" };
        return langMap[folderId] || "en-US";
    }

    // ========================================
    // ENGLISH PRONUNCIATION (UK/US)
    // ========================================

    // Audio player for dictionary pronunciations
    playDictionaryAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.onended = () => { this.isSpeaking = false; this.updateTTSButtons(false); resolve(); };
            audio.onerror = () => { this.isSpeaking = false; this.updateTTSButtons(false); reject(); };
            audio.onplay = () => { this.isSpeaking = true; this.updateTTSButtons(true); };
            audio.play().catch(reject);
        });
    }

    // Fetch pronunciation from Cambridge Dictionary
    async fetchCambridgeAudio(word, accent = 'uk') {
        const cleanWord = word.toLowerCase().trim().replace(/[^a-z\s-]/g, '').replace(/\s+/g, '-');
        // Cambridge audio URL pattern
        const region = accent === 'uk' ? 'uk' : 'us';
        const audioUrl = `https://dictionary.cambridge.org/media/english/${region}_pron/${cleanWord.charAt(0)}/${cleanWord.substring(0,3)}/${cleanWord}.mp3`;
        return audioUrl;
    }

    // Fetch pronunciation from Oxford Dictionary
    async fetchOxfordAudio(word, accent = 'uk') {
        const cleanWord = word.toLowerCase().trim().replace(/[^a-z\s-]/g, '').replace(/\s+/g, '_');
        // Oxford audio URL pattern
        const region = accent === 'uk' ? 'uk_pron' : 'us_pron';
        const audioUrl = `https://www.oxfordlearnersdictionaries.com/media/english/${region}/${cleanWord.substring(0,1)}/${cleanWord.substring(0,3)}/${cleanWord}__gb_1.mp3`;
        return audioUrl;
    }

    // Try to play English pronunciation with fallback
    async speakEnglish(text, accent = 'us') {
        if (this.isSpeaking) {
            this.speechSynthesis.cancel();
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }
        }
        if (!text || text === "Click to start" || text === "No cards available") return;

        const word = text.split(/\s+/)[0]; // Get first word for dictionary lookup

        // Try Cambridge first, then Oxford, then fallback to Web Speech API
        const sources = [
            () => this.fetchCambridgeAudio(word, accent),
            () => this.fetchOxfordAudio(word, accent)
        ];

        for (const getUrl of sources) {
            try {
                const url = await getUrl();
                await this.playDictionaryAudio(url);
                return; // Success!
            } catch (e) {
                // Try next source
            }
        }

        // Fallback to Web Speech API
        const lang = accent === 'uk' ? 'en-GB' : 'en-US';
        this.speak(text, lang);
    }

    // Speak English directly with UK accent (no picker needed)
    speakEnglishUK(text) {
        this.speakEnglish(text, 'uk');
    }

    // Get the best available voice for a language
    getBestVoice(lang) {
        const voices = this.speechSynthesis.getVoices();
        if (!voices.length) return null;

        // Preferred voice names (natural/premium voices)
        const preferredVoices = {
            'en-GB': [
                'Google UK English Female',
                'Google UK English Male',
                'Microsoft Hazel',
                'Daniel',             // macOS UK
                'Kate',               // macOS UK
                'Serena',             // macOS UK
            ]
        };

        const preferred = preferredVoices[lang] || [];

        // Try to find a preferred voice
        for (const name of preferred) {
            const voice = voices.find(v => v.name.includes(name));
            if (voice) return voice;
        }

        // Fallback: find any voice matching the language
        const langMatch = voices.find(v => v.lang === lang);
        if (langMatch) return langMatch;

        // Fallback: find voice starting with language code
        const langPrefix = lang.split('-')[0];
        return voices.find(v => v.lang.startsWith(langPrefix)) || null;
    }

    speak(text, lang) {
        if (this.isSpeaking) { this.speechSynthesis.cancel(); }
        if (!text || text === "Click to start" || text === "No cards available") return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Try to get a better voice
        const voice = this.getBestVoice(lang);
        if (voice) {
            utterance.voice = voice;
        }

        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.onstart = () => { this.isSpeaking = true; this.updateTTSButtons(true); };
        utterance.onend = () => { this.isSpeaking = false; this.updateTTSButtons(false); };
        utterance.onerror = () => { this.isSpeaking = false; this.updateTTSButtons(false); };
        this.speechSynthesis.speak(utterance);
    }

    // Preload voices (they may not be available immediately)
    loadVoices() {
        return new Promise(resolve => {
            const voices = this.speechSynthesis.getVoices();
            if (voices.length) {
                resolve(voices);
            } else {
                this.speechSynthesis.onvoiceschanged = () => {
                    resolve(this.speechSynthesis.getVoices());
                };
            }
        });
    }

    updateTTSButtons(speaking) {
        document.querySelectorAll(".tts-btn").forEach(btn => {
            btn.classList.toggle("speaking", speaking);
        });
    }

    speakFront() {
        if (this.studyCards.length === 0) return;
        const card = this.studyCards[this.currentIndex];
        const text = this.showTermFirst ? card.front : card.back;

        // Check if English - use UK accent directly
        const isEnglishTerm = this.showTermFirst && this.currentFolder === 'english';
        const isEnglishDef = !this.showTermFirst;

        if (isEnglishTerm || isEnglishDef) {
            this.speakEnglishUK(text);
        } else {
            const lang = this.getLanguageCode(this.currentFolder);
            this.speak(text, lang);
        }
    }

    speakBack() {
        if (this.studyCards.length === 0) return;
        const card = this.studyCards[this.currentIndex];
        const text = this.showTermFirst ? card.back : card.front;

        // Check if English - use UK accent directly
        const isEnglishDef = this.showTermFirst; // Back is definition (English)
        const isEnglishTerm = !this.showTermFirst && this.currentFolder === 'english';

        if (isEnglishDef || isEnglishTerm) {
            this.speakEnglishUK(text);
        } else {
            const lang = this.getLanguageCode(this.currentFolder);
            this.speak(text, lang);
        }
    }

    speakText(text, isDefinition = false) {
        // For term list items
        const isEnglish = isDefinition || this.currentFolder === 'english';

        if (isEnglish) {
            this.speakEnglishUK(text);
        } else {
            const lang = this.getLanguageCode(this.currentFolder);
            this.speak(text, lang);
        }
    }

    startLearnMode() { this.learnIndex = 0; this.learnCorrect = 0; this.studyCards = this.shuffleArray([...this.currentCards]); this.showLearnQuestion(); }

    showLearnQuestion() {
        if (this.learnIndex >= this.studyCards.length || this.studyCards.length === 0) { this.showLearnComplete(); return; }
        document.getElementById("learn-card").classList.remove("hidden");
        document.getElementById("learn-result").classList.add("hidden");
        const card = this.studyCards[this.learnIndex];
        document.getElementById("learn-question").textContent = card.front;
        const options = this.generateOptions(card);
        const optionsContainer = document.getElementById("learn-options"); optionsContainer.innerHTML = "";
        options.forEach((option) => {
            const btn = document.createElement("button"); btn.className = "learn-option"; btn.textContent = option;
            btn.addEventListener("click", () => this.checkLearnAnswer(option, card.back));
            optionsContainer.appendChild(btn);
        });
        const progress = (this.learnIndex / this.studyCards.length) * 100;
        document.getElementById("learn-progress-fill").style.width = progress + "%";
        document.getElementById("learn-progress-text").textContent = this.learnIndex + " / " + this.studyCards.length;
    }

    generateOptions(correctCard) {
        const options = [correctCard.back];
        let otherCards = this.currentCards.filter(c => c.id !== correctCard.id);
        while (options.length < 4 && otherCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherCards.length);
            const option = otherCards[randomIndex].back;
            if (!options.includes(option)) { options.push(option); }
            otherCards.splice(randomIndex, 1);
        }
        return this.shuffleArray(options);
    }

    checkLearnAnswer(selected, correct) {
        const buttons = document.querySelectorAll(".learn-option");
        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correct) { btn.classList.add("correct"); }
            else if (btn.textContent === selected && selected !== correct) { btn.classList.add("incorrect"); }
        });
        if (selected === correct) { this.learnCorrect++; }
        setTimeout(() => { this.learnIndex++; this.showLearnQuestion(); }, 1000);
    }

    showLearnComplete() {
        document.getElementById("learn-card").classList.add("hidden");
        document.getElementById("learn-result").classList.remove("hidden");
        const total = this.studyCards.length || 1;
        const percentage = Math.round((this.learnCorrect / total) * 100);
        document.querySelector(".result-text").textContent = "You got " + this.learnCorrect + " out of " + this.studyCards.length + " correct (" + percentage + "%)";
        document.getElementById("learn-progress-fill").style.width = "100%";
        document.getElementById("learn-progress-text").textContent = this.studyCards.length + " / " + this.studyCards.length;
    }

    nextLearnQuestion() { this.startLearnMode(); }

    startTestMode() {
        document.getElementById("test-results").classList.add("hidden");
        document.getElementById("submit-test-btn").classList.remove("hidden");
        const container = document.getElementById("test-questions"); container.innerHTML = "";
        const testCards = this.shuffleArray([...this.currentCards]).slice(0, Math.min(10, this.currentCards.length));
        if (testCards.length === 0) { container.innerHTML = "<p style=\"text-align: center; color: #666;\">Add some cards to take a test</p>"; document.getElementById("submit-test-btn").classList.add("hidden"); return; }
        testCards.forEach((card, index) => {
            const questionDiv = document.createElement("div"); questionDiv.className = "test-question"; questionDiv.dataset.answer = card.back;
            questionDiv.innerHTML = "<p class=\"test-question-text\">" + (index + 1) + ". " + this.escapeHtml(card.front) + "</p><input type=\"text\" class=\"test-input\" placeholder=\"Type your answer\">";
            container.appendChild(questionDiv);
        });
    }

    submitTest() {
        const questions = document.querySelectorAll(".test-question"); let correct = 0;
        questions.forEach(q => {
            const input = q.querySelector(".test-input");
            const answer = q.dataset.answer.toLowerCase().trim();
            const userAnswer = input.value.toLowerCase().trim();
            if (userAnswer === answer || this.fuzzyMatch(userAnswer, answer)) { input.classList.add("correct"); correct++; }
            else { input.classList.add("incorrect"); const correctAnswerDiv = document.createElement("p"); correctAnswerDiv.className = "correct-answer"; correctAnswerDiv.textContent = "Correct: " + q.dataset.answer; q.appendChild(correctAnswerDiv); }
        });
        document.getElementById("submit-test-btn").classList.add("hidden");
        document.getElementById("test-results").classList.remove("hidden");
        document.getElementById("score-number").textContent = correct;
        document.getElementById("score-total").textContent = questions.length;
        const percentage = Math.round((correct / questions.length) * 100) || 0;
        let message = "";
        if (percentage === 100) message = "Perfect score!";
        else if (percentage >= 80) message = "Great job!";
        else if (percentage >= 60) message = "Good effort!";
        else message = "Keep practicing!";
        document.getElementById("results-text").textContent = message;
    }

    fuzzyMatch(userAnswer, correctAnswer) {
        if (userAnswer.length < 3) return false;
        const distance = this.levenshteinDistance(userAnswer, correctAnswer);
        return distance <= Math.floor(correctAnswer.length * 0.2);
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) { matrix[i][j] = matrix[i - 1][j - 1]; }
                else { matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1); }
            }
        }
        return matrix[b.length][a.length];
    }

    startMatchMode() {
        this.matchTime = 0; this.matchedPairs = 0; this.selectedTile = null;
        document.getElementById("match-grid").classList.remove("hidden");
        document.getElementById("match-complete").classList.add("hidden");
        const matchCards = this.shuffleArray([...this.currentCards]).slice(0, 6);
        if (matchCards.length === 0) { document.getElementById("match-grid").innerHTML = "<p style=\"grid-column: span 4; text-align: center; color: #666;\">Add at least 1 card to play</p>"; return; }
        const tiles = [];
        matchCards.forEach(card => { tiles.push({ id: card.id, text: card.front, type: "term" }); tiles.push({ id: card.id, text: card.back, type: "definition" }); });
        const shuffledTiles = this.shuffleArray(tiles);
        const grid = document.getElementById("match-grid"); grid.innerHTML = "";
        shuffledTiles.forEach((tile) => {
            const tileEl = document.createElement("div"); tileEl.className = "match-tile";
            tileEl.dataset.id = tile.id; tileEl.dataset.type = tile.type; tileEl.textContent = tile.text;
            tileEl.addEventListener("click", () => this.selectTile(tileEl));
            grid.appendChild(tileEl);
        });
        if (this.matchTimer) clearInterval(this.matchTimer);
        this.matchTimer = setInterval(() => { this.matchTime += 0.1; document.getElementById("match-time").textContent = this.matchTime.toFixed(1); }, 100);
    }

    selectTile(tile) {
        if (tile.classList.contains("matched") || tile.classList.contains("selected")) return;
        tile.classList.add("selected");
        if (!this.selectedTile) { this.selectedTile = tile; }
        else {
            const firstId = this.selectedTile.dataset.id; const secondId = tile.dataset.id;
            const firstType = this.selectedTile.dataset.type; const secondType = tile.dataset.type;
            if (firstId === secondId && firstType !== secondType) {
                this.selectedTile.classList.add("matched"); tile.classList.add("matched"); this.matchedPairs++;
                const totalPairs = Math.min(6, this.currentCards.length);
                if (this.matchedPairs === totalPairs) { this.endMatchGame(); }
            } else {
                this.selectedTile.classList.add("wrong"); tile.classList.add("wrong");
                const prevTile = this.selectedTile;
                setTimeout(() => { prevTile.classList.remove("selected", "wrong"); tile.classList.remove("selected", "wrong"); }, 500);
            }
            this.selectedTile.classList.remove("selected"); tile.classList.remove("selected"); this.selectedTile = null;
        }
    }

    endMatchGame() {
        clearInterval(this.matchTimer);
        document.getElementById("match-grid").classList.add("hidden");
        document.getElementById("match-complete").classList.remove("hidden");
        document.getElementById("final-time").textContent = this.matchTime.toFixed(1);
    }

    renderTermsList() {
        const container = document.getElementById("terms-list"); container.innerHTML = "";
        this.currentCards.forEach(card => {
            const item = document.createElement("div"); item.className = "term-item";
            const masteryClass = card.mastery === "mastered" ? "mastery-mastered" : card.mastery === "learning" ? "mastery-learning" : "";
            item.innerHTML = `
                <div class="term-mastery-indicator ${masteryClass}"></div>
                ${card.image ? `<div class="term-image"><img src="${card.image}" alt=""></div>` : ''}
                <div class="term-content ${card.image ? 'has-image' : ''}">
                    <div class="term-front">
                        <span class="term-text">${this.escapeHtml(card.front)}</span>
                        <button class="tts-btn term-tts-btn" title="Listen">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 010 7.07"/>
                            </svg>
                        </button>
                    </div>
                    <div class="term-back">
                        <span class="term-text">${this.escapeHtml(card.back)}</span>
                        <button class="tts-btn term-tts-btn" title="Listen">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 010 7.07"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="term-actions">
                    <button class="term-action-btn star ${card.starred ? "active" : ""}" title="Star">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="${card.starred ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                    <button class="term-action-btn edit" title="Edit">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="term-action-btn delete" title="Delete">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            `;
            item.querySelector(".term-front .term-tts-btn").addEventListener("click", () => this.speakText(card.front, false));
            item.querySelector(".term-back .term-tts-btn").addEventListener("click", () => this.speakText(card.back, true));
            item.querySelector(".star").addEventListener("click", () => this.toggleStar(card.id));
            item.querySelector(".edit").addEventListener("click", () => this.showCardModal(card));
            item.querySelector(".delete").addEventListener("click", () => this.deleteCard(card.id));
            container.appendChild(item);
        });
    }

    escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }

    handleKeyboard(e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (document.querySelector(".modal.active")) return;
        if (!document.getElementById("set-view").classList.contains("hidden") && this.currentMode === "flashcards") {
            switch (e.key) {
                case " ": e.preventDefault(); this.flipCard(); break;
                case "ArrowLeft": this.previousCard(); break;
                case "ArrowRight": this.nextCard(); break;
            }
        }
    }

    // ========================================
    // TOUCH/SWIPE GESTURES
    // ========================================

    initTouchGestures() {
        const flashcard = document.getElementById('flashcard');
        if (!flashcard) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 50;

        flashcard.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        flashcard.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY, minSwipeDistance);
        }, { passive: true });
    }

    handleSwipe(startX, startY, endX, endY, minDistance) {
        const diffX = endX - startX;
        const diffY = endY - startY;

        // Check if horizontal swipe is dominant
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minDistance) {
            if (!document.getElementById("set-view").classList.contains("hidden") && this.currentMode === "flashcards") {
                if (diffX > 0) {
                    // Swipe right -> previous card
                    this.previousCard();
                } else {
                    // Swipe left -> next card
                    this.nextCard();
                }
            }
        } else if (Math.abs(diffY) > minDistance && Math.abs(diffY) > Math.abs(diffX)) {
            // Vertical swipe -> flip card
            if (!document.getElementById("set-view").classList.contains("hidden") && this.currentMode === "flashcards") {
                this.flipCard();
            }
        }
    }

    // ========================================
    // AUTH & SYNC
    // ========================================

    initAuth() {
        // Initialize API and Sync Manager
        if (typeof api !== 'undefined') {
            this.api = api;
            this.sync = new SyncManager(this, api);

            // Set auth change callback
            this.api.onAuthChange = (user) => this.updateAuthUI(user);

            // Check if already logged in
            const user = this.api.getUser();
            if (user) {
                this.updateAuthUI(user);
                // Perform initial sync if online
                if (navigator.onLine) {
                    this.sync.checkAndSync();
                }
            }
        }
    }

    updateAuthUI(user) {
        const loginBtn = document.getElementById('login-btn');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');

        if (user) {
            // Logged in
            loginBtn?.classList.add('hidden');
            userMenu?.classList.remove('hidden');
            if (userName) userName.textContent = user.name || 'User';
            if (userAvatar) userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
        } else {
            // Logged out
            loginBtn?.classList.remove('hidden');
            userMenu?.classList.add('hidden');
        }
    }

    showAuthModal(mode = 'login') {
        this.authMode = mode;
        const modal = document.getElementById('auth-modal');
        const title = document.getElementById('auth-modal-title');
        const nameGroup = document.getElementById('auth-name-group');
        const submitBtn = document.getElementById('auth-submit');
        const switchText = document.getElementById('auth-switch-text');
        const switchBtn = document.getElementById('auth-switch-btn');
        const errorEl = document.getElementById('auth-error');

        // Reset form
        document.getElementById('auth-form')?.reset();
        errorEl?.classList.add('hidden');

        if (mode === 'login') {
            title.textContent = 'Login';
            nameGroup?.classList.add('hidden');
            submitBtn.textContent = 'Login';
            switchText.textContent = "Don't have an account?";
            switchBtn.textContent = 'Sign up';
        } else {
            title.textContent = 'Create Account';
            nameGroup?.classList.remove('hidden');
            submitBtn.textContent = 'Create Account';
            switchText.textContent = 'Already have an account?';
            switchBtn.textContent = 'Login';
        }

        modal?.classList.add('active');
    }

    hideAuthModal() {
        document.getElementById('auth-modal')?.classList.remove('active');
    }

    toggleAuthMode() {
        this.showAuthModal(this.authMode === 'login' ? 'register' : 'login');
    }

    async handleAuth() {
        const email = document.getElementById('auth-email')?.value;
        const password = document.getElementById('auth-password')?.value;
        const name = document.getElementById('auth-name')?.value;
        const errorEl = document.getElementById('auth-error');
        const submitBtn = document.getElementById('auth-submit');

        if (!email || !password) {
            this.showAuthError('Please fill in all fields');
            return;
        }

        if (this.authMode === 'register' && !name) {
            this.showAuthError('Please enter your name');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = this.authMode === 'login' ? 'Logging in...' : 'Creating account...';

        try {
            let result;
            if (this.authMode === 'login') {
                result = await this.api.login(email, password);
            } else {
                result = await this.api.register(email, password, name);
            }

            if (result.success) {
                this.hideAuthModal();
                // Update UI
                this.updateAuthUI(result.data.user);
                // Perform initial sync
                if (this.sync) {
                    await this.sync.initialSync();
                }
            } else {
                this.showAuthError(result.message || 'Authentication failed');
            }
        } catch (error) {
            this.showAuthError(error.message || 'An error occurred');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = this.authMode === 'login' ? 'Login' : 'Create Account';
        }
    }

    showAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    toggleUserDropdown() {
        const dropdown = document.getElementById('user-dropdown');
        dropdown?.classList.toggle('hidden');

        // Close on outside click
        const closeDropdown = (e) => {
            if (!e.target.closest('.user-menu')) {
                dropdown?.classList.add('hidden');
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }

    async handleLogout() {
        if (this.api) {
            await this.api.logout();
        }
        this.updateAuthUI(null);
        document.getElementById('user-dropdown')?.classList.add('hidden');
    }
}

const app = new FlashcardApp();
