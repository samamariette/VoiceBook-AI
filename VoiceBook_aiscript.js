// VoiceBook AI - Complete Voice-Controlled Literary Companion with OpenAI
class VoiceBookAI {
    constructor() {
        this.isListening = false;
        this.isAwake = false;
        this.speechRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.wakeWord = "hey book";
        this.currentChapter = 1;
        this.conversationHistory = [];
        this.isSpeaking = false;
        this.ignoreNextResult = false;
        this.openAIKey = null;
        this.isAPIReady = false;
        this.thinkingInterval = null;
        this.sleepTimer = null;
        this.openAIModel = 'gpt-3.5-turbo';
        this.bookContent = null;
        this.isBookLoaded = false;
        
        // Extended sleep timeout - 30 minutes instead of quick timeout
        this.sleepTimeout = 1800000; // 30 minutes
        
        // Initialize the application
        this.initializeApp();
    }

    async initializeApp() {
        // DOM Elements
        this.voiceIndicator = document.getElementById('voiceIndicator');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.aiStatus = document.getElementById('aiStatus');
        this.currentChapterElement = document.getElementById('currentChapter');
        this.conversationElement = document.getElementById('conversation');
        this.srAnnounce = document.getElementById('srAnnounce');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.activateAIButton = document.getElementById('activateAI');
        this.apiStatus = document.getElementById('apiStatus');

        // Set current time in welcome message
        this.updateCurrentTime();

        // Load the complete book
        await this.loadCompleteBook();

        // Wait for voices to be loaded
        this.loadVoices();

        // Initialize voice recognition
        this.initializeVoiceRecognition();
        
        // Update status
        this.updateVoiceStatus('Ready to listen');
        
        // Add event listeners
        this.voiceIndicator.addEventListener('click', () => this.toggleListening());
        this.activateAIButton.addEventListener('click', () => this.activateAI());
        this.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.activateAI();
        });

        // Add quick action button listeners
        document.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const command = e.currentTarget.getAttribute('data-command');
                this.handleQuickAction(command);
            });
        });

        // Add chapter navigation listeners
        document.querySelectorAll('.chapter-nav-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const chapter = e.currentTarget.getAttribute('data-chapter');
                this.handleChapterNavigation(chapter);
            });
        });
    }

    async loadCompleteBook() {
        try {
            // Try to load from external file first
            const response = await fetch('/books/pride-and-prejudice-full.txt');
            if (response.ok) {
                const fullText = await response.text();
                this.bookContent = this.parseBookContent(fullText);
                this.isBookLoaded = true;
                console.log('Complete book loaded successfully');
                return;
            }
        } catch (error) {
            console.log('External book file not found, using embedded method');
        }

        // If external file fails, use Project Gutenberg API
        try {
            await this.loadBookFromGutenberg();
        } catch (error) {
            console.error('Failed to load book:', error);
            this.useFallbackBookContent();
        }
    }

    async loadBookFromGutenberg() {
        // Project Gutenberg URL for Pride and Prejudice
        const gutenbergUrl = 'https://www.gutenberg.org/cache/epub/1342/pg1342.txt';
        
        const response = await fetch(gutenbergUrl);
        if (!response.ok) throw new Error('Failed to fetch from Gutenberg');
        
        const text = await response.text();
        this.bookContent = this.parseGutenbergContent(text);
        this.isBookLoaded = true;
        console.log('Book loaded from Project Gutenberg');
    }

    parseGutenbergContent(text) {
        const chapters = {};
        const lines = text.split('\n');
        let currentChapter = 0;
        let inChapter = false;
        let chapterContent = [];

        for (let line of lines) {
            line = line.trim();
            
            // Look for chapter markers
            if (line.match(/^CHAPTER\s+\w+/i) || line.match(/^Chapter\s+\d+/)) {
                if (inChapter && chapterContent.length > 0) {
                    chapters[currentChapter] = chapterContent.join('\n').trim();
                    chapterContent = [];
                }
                currentChapter++;
                inChapter = true;
                continue;
            }
            
            // Skip header and footer sections
            if (line.includes('*** START OF') || line.includes('*** END OF')) {
                continue;
            }
            
            if (inChapter && line.length > 0) {
                chapterContent.push(line);
            }
        }

        // Add the last chapter
        if (chapterContent.length > 0) {
            chapters[currentChapter] = chapterContent.join('\n').trim();
        }

        return chapters;
    }

    useFallbackBookContent() {
        // Provide at least the first few chapters embedded
        this.bookContent = {
            1: `CHAPTER 1\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife...`,
            2: `CHAPTER 2\n\nMr. Bennet was among the earliest of those who waited on Mr. Bingley...`,
            // Add more chapters as needed...
        };
        this.isBookLoaded = true;
        console.log('Using fallback book content');
    }

    getBookContent(chapter) {
        if (!this.isBookLoaded || !this.bookContent) {
            return "The book content is still loading. Please try again in a moment.";
        }

        if (chapter < 1 || chapter > 61) {
            return `Chapter ${chapter} doesn't exist. Pride and Prejudice has 61 chapters.`;
        }

        const content = this.bookContent[chapter];
        if (!content) {
            return `Chapter ${chapter} is not available in the current book version. Try another chapter between 1 and 61.`;
        }

        return content;
    }

    updateCurrentTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString([], { 
                hour: '2-digit', minute: '2-digit' 
            });
        }
    }

    async activateAI() {
        const apiKey = this.apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showNotification('Please enter your OpenAI API key', 'error');
            this.apiStatus.innerHTML = '<span style="color: #e74c3c;">❌ Please enter API key</span>';
            return;
        }

        this.activateAIButton.textContent = '🔄 Testing OpenAI API...';
        this.activateAIButton.disabled = true;
        this.apiStatus.innerHTML = '<span style="color: #f39c12;">🔄 Testing OpenAI connection...</span>';

        try {
            const isValid = await this.testOpenAIAPI(apiKey);
            if (isValid) {
                this.openAIKey = apiKey;
                this.isAPIReady = true;
                this.apiKeyInput.disabled = true;
                this.activateAIButton.textContent = '✅ AI Active';
                this.activateAIButton.disabled = true;
                this.apiStatus.innerHTML = '<span style="color: #27ae60;">✅ OpenAI Activated Successfully!</span>';
                this.updateAIStatus('OpenAI Literary Expert Ready');
                this.showNotification('OpenAI activated successfully! Full literary analysis available.', 'success');
                this.addSystemMessage('🧠 OpenAI Literary Expert is now active! I can provide detailed analysis and read all 61 chapters of Pride and Prejudice.');
                
                setTimeout(() => {
                    this.speakText("OpenAI Literary Expert activated! I have access to all 61 chapters of Pride and Prejudice and can provide deep literary analysis.");
                }, 1000);
            } else {
                throw new Error('Invalid API key or connection failed');
            }
        } catch (error) {
            console.error('OpenAI Activation Error:', error);
            this.activateAIButton.textContent = '🧠 Activate OpenAI AI';
            this.activateAIButton.disabled = false;
            this.apiStatus.innerHTML = `<span style="color: #e74c3c;">❌ ${error.message}</span>`;
            this.showNotification('Failed to activate OpenAI. Please check your API key.', 'error');
        }
    }

    async testOpenAIAPI(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: "user",
                            content: "Respond with just 'OK' to confirm connection."
                        }
                    ],
                    max_tokens: 5
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices && data.choices[0] && data.choices[0].message;
            
        } catch (error) {
            console.error('OpenAI API Test Failed:', error);
            throw new Error('API connection failed. Please check your API key and internet connection.');
        }
    }

    async handleChapterCommand(transcript) {
        const chapterMatch = transcript.match(/chapter\s+(\d+)/i) || 
                            transcript.match(/(\d+)(?:\s+chapter)?/i) ||
                            transcript.match(/read\s+(\d+)/i);
        
        const chapterNum = chapterMatch ? parseInt(chapterMatch[1]) : this.currentChapter;
        
        if (chapterNum < 1 || chapterNum > 61) {
            const message = `Chapter ${chapterNum} doesn't exist. Pride and Prejudice has 61 chapters (1-61).`;
            this.addAIMessage(message);
            this.speakText(message);
            return;
        }

        this.currentChapter = chapterNum;
        if (this.currentChapterElement) {
            this.currentChapterElement.textContent = chapterNum;
        }
        
        // Update chapter navigation UI
        this.updateChapterNavigation();
        
        this.addSystemMessage(`📖 Loading Chapter ${chapterNum}...`);
        
        try {
            const chapterContent = this.getBookContent(chapterNum);
            
            if (chapterContent.includes('not available') || chapterContent.includes('still loading')) {
                this.addAIMessage(chapterContent);
                this.speakText("I'm having trouble loading that chapter. Please try another chapter or wait a moment.");
                return;
            }
            
            // Display in conversation
            this.addAIMessage(`**Chapter ${chapterNum}**\n\n${chapterContent}`);
            
            // Speak the content (limit length for speech)
            const speakableContent = this.processContentForSpeech(chapterContent);
            this.speakText(`Chapter ${chapterNum}. ${speakableContent}`);
            
        } catch (error) {
            console.error('Error loading chapter:', error);
            const errorMessage = `Unable to load Chapter ${chapterNum}. Please try another chapter.`;
            this.addAIMessage(errorMessage);
            this.speakText("Sorry, I couldn't load that chapter. Please try another one.");
        }
    }

    processContentForSpeech(content) {
        // Clean and limit content for speech
        let processed = content
            .replace(/CHAPTER\s+\w+/gi, '')
            .replace(/["'`\[\](){}]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        // Limit to reasonable length for speech
        if (processed.length > 1500) {
            processed = processed.substring(0, 1500) + "... [Chapter continues]";
        }
        
        return processed;
    }

    handleChapterNavigation(chapter) {
        if (chapter === 'prev') {
            this.currentChapter = Math.max(1, this.currentChapter - 1);
        } else if (chapter === 'next') {
            this.currentChapter = Math.min(61, this.currentChapter + 1);
        } else {
            this.currentChapter = parseInt(chapter);
        }
        
        this.currentChapterElement.textContent = this.currentChapter;
        this.updateChapterNavigation();
        this.handleChapterCommand(`read chapter ${this.currentChapter}`);
    }

    updateChapterNavigation() {
        document.querySelectorAll('.chapter-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-chapter') === this.currentChapter.toString()) {
                btn.classList.add('active');
            }
        });
    }

    // VOICE RECOGNITION METHODS
    loadVoices() {
        let voices = this.speechSynthesis.getVoices();
        if (voices.length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                voices = this.speechSynthesis.getVoices();
            });
        }
    }

    getFeminineVoice() {
        const voices = this.speechSynthesis.getVoices();
        const preferredVoices = [
            'Google UK English Female', 'Microsoft Zira Desktop', 
            'Samantha', 'Karen', 'Tessa', 'Victoria', 'Fiona'
        ];

        for (const voiceName of preferredVoices) {
            const voice = voices.find(v => v.name.includes(voiceName));
            if (voice) return voice;
        }

        const femaleVoice = voices.find(v => 
            v.name.toLowerCase().includes('female') || 
            (v.lang.includes('en') && !v.name.toLowerCase().includes('male'))
        );

        return femaleVoice || voices[0];
    }

    initializeVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.continuous = true;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.lang = 'en-US';

            this.speechRecognition.onstart = () => {
                this.isListening = true;
                this.updateListeningUI(true);
                this.updateVoiceStatus('Listening for your voice...');
            };

            this.speechRecognition.onresult = (event) => {
                if (this.isSpeaking || this.ignoreNextResult) {
                    this.ignoreNextResult = false;
                    return;
                }

                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript.toLowerCase();
                    }
                }

                if (finalTranscript) {
                    console.log('Processing command:', finalTranscript);
                    this.processVoiceCommand(finalTranscript);
                }
            };

            this.speechRecognition.onerror = (event) => {
                console.log('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    this.updateVoiceStatus('Microphone access denied');
                    this.showNotification('Microphone permission required. Please allow access in browser settings.', 'error');
                }
            };

            this.speechRecognition.onend = () => {
                this.isListening = false;
                this.updateListeningUI(false);
                if (this.isAwake && !this.isSpeaking) {
                    setTimeout(() => {
                        if (this.speechRecognition && !this.isListening) {
                            this.speechRecognition.start();
                        }
                    }, 1000);
                }
            };

            // Start recognition
            setTimeout(() => {
                if (this.speechRecognition && !this.isListening) {
                    this.speechRecognition.start();
                }
            }, 2000);
            
        } else {
            this.updateVoiceStatus('Voice recognition not supported');
            this.showNotification('Voice recognition is not supported in your browser. Please use Chrome or Edge.', 'error');
        }
    }

    processVoiceCommand(transcript) {
        // Reset sleep timer on any voice activity
        this.resetSleepTimer();

        if (this.isAwake && transcript.includes(this.wakeWord)) {
            // If already awake and wake word is detected, just acknowledge
            this.speakText("I'm already listening! What would you like to know?");
            return;
        }
        
        if (!this.isAwake && transcript.includes(this.wakeWord)) {
            this.wakeUp();
            return;
        }

        if (this.isAwake) {
            // Handle book content commands
            if (transcript.includes('chapter') || transcript.includes('read') || 
                transcript.match(/\d+/)) {
                this.handleChapterCommand(transcript);
            }
            // Handle analysis commands with OpenAI
            else {
                this.handleUserQuestion(transcript);
            }
        }
    }

    resetSleepTimer() {
        clearTimeout(this.sleepTimer);
        if (this.isAwake) {
            this.sleepTimer = setTimeout(() => this.sleep(), this.sleepTimeout);
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (this.speechRecognition && !this.isListening && !this.isSpeaking) {
            this.speechRecognition.start();
        }
    }

    stopListening() {
        if (this.speechRecognition && this.isListening) {
            this.speechRecognition.stop();
        }
    }

    wakeUp() {
        this.isAwake = true;
        this.updateVoiceStatus('I\'m listening! Ask your question...');
        this.updateAIStatus('OpenAI Active - Ready for your questions');
        
        // Reset sleep timer with extended timeout
        this.resetSleepTimer();
        
        const bookStatus = this.isBookLoaded ? 
            "I have access to all 61 chapters of Pride and Prejudice." : 
            "I'm still loading the complete book content.";
            
        if (this.isAPIReady) {
            this.addSystemMessage(`🧠 OpenAI is active! ${bookStatus} Ask me any literary questions or say "read chapter" to hear the book.`);
            this.speakText(`Hello! OpenAI is ready. ${bookStatus} Try saying "read chapter one" or ask me about characters and themes.`);
        } else {
            this.addSystemMessage(`📚 VoiceBook AI is active! ${bookStatus} For detailed literary analysis, please activate OpenAI.`);
            this.speakText(`Hello! ${bookStatus} I can help with basic navigation and read chapters. For detailed literary analysis with OpenAI, please activate it.`);
        }
    }

    sleep() {
        this.isAwake = false;
        this.updateVoiceStatus('Ready to listen');
        this.updateAIStatus('Activate to begin');
        this.addSystemMessage('VoiceBook AI is in sleep mode. Say "Hey Book" to wake me up.');
        this.speakText('Going to sleep now. Say Hey Book when you need me again.');
    }

    handleUserQuestion(question) {
        this.resetSleepTimer();
        this.addUserMessage(question);
        this.stopListening();
        this.ignoreNextResult = true;

        this.processQuestion(question);
    }

    handleQuickAction(command) {
        let question = '';
        switch(command) {
            case 'help':
                question = 'help';
                break;
            case 'characters':
                question = 'tell me about the main characters in pride and prejudice';
                break;
            case 'themes':
                question = 'what are the main themes in pride and prejudice';
                break;
            case 'plot':
                question = 'give me a plot summary of pride and prejudice';
                break;
        }
        
        this.addUserMessage(question);
        this.processQuestion(question);
    }

    async processQuestion(question) {
        this.updateAIStatus('OpenAI Thinking...');
        this.addThinkingMessage();

        try {
            let response;
            
            // Use OpenAI if available
            if (this.isAPIReady && this.openAIKey) {
                response = await this.getOpenAIResponse(question);
            }
            // Fallback for basic queries without AI
            else {
                response = this.getBasicResponse(question);
            }
            
            this.removeThinkingMessage();
            this.addAIMessage(response);
            this.speakText(response);
            this.updateAIStatus('OpenAI Active - Ready for your questions');
            
        } catch (error) {
            console.error('Error processing question:', error);
            this.removeThinkingMessage();
            this.handleAIError(error);
        }
    }

    async getOpenAIResponse(question) {
        if (!this.openAIKey) {
            throw new Error('OpenAI API key not configured');
        }

        const systemPrompt = `You are a literary expert specializing in Jane Austen's "Pride and Prejudice." You have deep knowledge of all 61 chapters of the novel.

Please provide:
1. Accurate, detailed analysis based on the actual text
2. Specific examples and quotes when relevant
3. Historical context about Regency England
4. Literary analysis of Austen's techniques
5. Character development insights across all chapters
6. Theme exploration throughout the novel

Be scholarly but accessible. Keep responses engaging and informative, around 200-300 words.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openAIKey}`
                },
                body: JSON.stringify({
                    model: this.openAIModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: question }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('OpenAI API Error:', data);
                throw new Error(data.error?.message || `API error: ${response.status}`);
            }

            return data.choices[0].message.content;

        } catch (error) {
            console.error('OpenAI API Request Failed:', error);
            throw error;
        }
    }

    getBasicResponse(question) {
        const lowerQuestion = question.toLowerCase();
        
        if (lowerQuestion.includes('help')) {
            return `I can help you explore all 61 chapters of Pride and Prejudice:

📖 **BOOK READING**: Say "read chapter 1" or "go to chapter 25" to hear any chapter.

🧠 **LITERARY ANALYSIS**: Activate OpenAI for detailed analysis of:
• Characters and their development across all chapters
• Themes and social commentary throughout the novel
• Literary techniques and Austen's writing style
• Historical context of Regency England
• Complete plot analysis

🎯 **QUICK COMMANDS**:
• "Read Chapter [1-61]" - Hear any chapter
• "Tell me about Elizabeth's development" - Character analysis
• "What are the marriage themes?" - Theme exploration
• "Analyze Darcy's proposal" - Scene analysis

Activate OpenAI using your API key for advanced literary analysis of all 61 chapters!`;
        }
        
        return `I'd love to help you explore all 61 chapters of Pride and Prejudice! 

You can:
• Say "read chapter 1" to hear the beginning (or any chapter 1-61)
• Ask about characters, themes, or specific scenes
• Activate OpenAI for detailed literary analysis of the entire novel

Try saying "help" to see all available commands.`;
    }

    speakText(text) {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        this.isSpeaking = true;
        this.updateVoiceStatus('Speaking...');

        this.currentUtterance = new SpeechSynthesisUtterance();
        
        this.currentUtterance.rate = 0.85;
        this.currentUtterance.pitch = 1.1;
        this.currentUtterance.volume = 0.9;
        this.currentUtterance.lang = 'en-GB';

        const feminineVoice = this.getFeminineVoice();
        if (feminineVoice) {
            this.currentUtterance.voice = feminineVoice;
        }

        const processedText = this.processTextForSpeech(text);
        this.currentUtterance.text = processedText;

        this.currentUtterance.onstart = () => {
            this.isSpeaking = true;
        };

        this.currentUtterance.onend = () => {
            this.isSpeaking = false;
            this.updateVoiceStatus('Ready for your question...');
            
            setTimeout(() => {
                if (this.isAwake && !this.isListening) {
                    this.startListening();
                }
            }, 1500);
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.isSpeaking = false;
            this.updateVoiceStatus('Ready for your question...');
        };

        this.speechSynthesis.speak(this.currentUtterance);
    }

    processTextForSpeech(text) {
        return text
            .replace(/["'`\[\](){}]/g, '')
            .replace(/[#*$@\\|<>]/g, '')
            .replace(/—/g, ', ')
            .replace(/ - /g, ', ')
            .replace(/\bMr\./g, 'Mister')
            .replace(/\bMrs\./g, 'Missus')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ... (rest of the UI methods remain the same as previous version)
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    updateVoiceStatus(message) {
        if (this.voiceStatus) this.voiceStatus.textContent = message;
        if (this.srAnnounce) this.srAnnounce.textContent = message;
    }

    updateAIStatus(status) {
        if (this.aiStatus) this.aiStatus.textContent = status;
    }

    updateListeningUI(listening) {
        if (this.voiceIndicator) {
            this.voiceIndicator.classList.toggle('listening', listening);
        }
    }

    addSystemMessage(content) {
        this.addMessage(content, 'system-message', '🔮', 'VoiceBook AI');
    }

    addUserMessage(content) {
        this.addMessage(content, 'user-message', '👤', 'You');
    }

    addAIMessage(content) {
        this.addMessage(content, 'ai-message', '🧠', 'Literary Guide');
    }

    addMessage(content, className, avatar, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <strong>${sender}</strong>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <p>${content.replace(/\n/g, '<br>')}</p>
            </div>
        `;
        if (this.conversationElement) {
            this.conversationElement.appendChild(messageDiv);
            this.scrollToBottom();
        }
    }

    addThinkingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.id = 'thinking-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">💭</div>
            <div class="message-content">
                <div class="message-header">
                    <strong>Literary Guide</strong>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <p>Thinking about your question... <span class="thinking-dots">...</span></p>
            </div>
        `;
        if (this.conversationElement) {
            this.conversationElement.appendChild(messageDiv);
            this.scrollToBottom();
        }
        this.animateThinkingDots();
    }

    removeThinkingMessage() {
        const thinkingMessage = document.getElementById('thinking-message');
        if (thinkingMessage) {
            thinkingMessage.remove();
        }
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
        }
    }

    animateThinkingDots() {
        const dots = document.querySelector('.thinking-dots');
        if (dots) {
            let dotCount = 0;
            this.thinkingInterval = setInterval(() => {
                dotCount = (dotCount + 1) % 4;
                dots.textContent = '.'.repeat(dotCount);
            }, 500);
        }
    }

    scrollToBottom() {
        if (this.conversationElement) {
            this.conversationElement.scrollTop = this.conversationElement.scrollHeight;
        }
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    handleAIError(error) {
        console.error('AI Error:', error);
        let errorMessage = "I'm having trouble with the AI connection. ";
        
        if (error.message.includes('Incorrect API key')) {
            errorMessage = "Your OpenAI API key appears to be invalid. Please check it and try again.";
            this.resetAPIState();
        } else if (error.message.includes('quota')) {
            errorMessage = "Your OpenAI quota has been exceeded. Check your usage or billing setup.";
        } else if (error.message.includes('rate limit')) {
            errorMessage = "Too many requests to OpenAI. Please wait a moment and try again.";
        } else {
            errorMessage = `Technical issue: ${error.message}. Please try again.`;
        }
        
        this.addAIMessage(errorMessage);
        this.speakText("I'm having technical difficulties with the AI connection.");
        this.updateAIStatus('Connection Issue');
    }

    resetAPIState() {
        this.openAIKey = null;
        this.isAPIReady = false;
        this.apiKeyInput.disabled = false;
        this.activateAIButton.textContent = '🧠 Activate OpenAI AI';
        this.activateAIButton.disabled = false;
        this.apiStatus.innerHTML = '<span style="color: #e74c3c;">❌ Invalid API key - Please try again</span>';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const voiceBookAI = new VoiceBookAI();
    window.voiceBookAI = voiceBookAI;
    
    console.log('VoiceBook AI with Complete Book Access loaded!');
    console.log('Available commands:');
    console.log('- "Read Chapter 1" through "Read Chapter 61"');
    console.log('- "Hey Book" to wake up the assistant');
    console.log('- Any literary analysis questions');
});
