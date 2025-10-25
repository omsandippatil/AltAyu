// Configuration
const GROQ_API_KEY = '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'; 
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

let currentMethod = 'text';
let selectedFile = null;

// Switch between text and image input methods
function switchMethod(method) {
    currentMethod = method;
    
    // Update button states
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide input containers
    document.querySelectorAll('.input-container').forEach(container => {
        container.classList.remove('active');
    });
    document.getElementById(`${method}-input`).classList.add('active');
    
    // Reset states
    hideResults();
    hideError();
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedFile = file;
        const preview = document.getElementById('preview');
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
}

// Convert image to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Main analysis function
async function analyzeInput() {
    hideError();
    hideResults();
    
    try {
        let userMessage;
        
        if (currentMethod === 'text') {
            const textInput = document.getElementById('textInput').value.trim();
            if (!textInput) {
                showError('Please enter medicine name or symptoms');
                return;
            }
            userMessage = textInput;
        } else {
            if (!selectedFile) {
                showError('Please select an image');
                return;
            }
            const base64Image = await fileToBase64(selectedFile);
            userMessage = {
                image: base64Image,
                text: 'Analyze this medicine packet image'
            };
        }
        
        showLoading();
        const result = await callGroqAPI(userMessage);
        displayResults(result);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred. Please try again.');
    } finally {
        hideLoading();
    }
}

// Call Groq API
async function callGroqAPI(userMessage) {
    const systemPrompt = `You are AltAyu, an expert in both modern medicine and Ayurveda. Provide DETAILED analysis with specific dosages and instructions.

Analyze the given medicine or symptoms and provide comprehensive information in this EXACT JSON structure:

{
  "medicine": {
    "name": "Medicine name",
    "category": "e.g., Analgesic, Antibiotic, etc.",
    "contents": [
      {
        "name": "Active ingredient name",
        "dosage": "Amount per tablet/dose (e.g., 500mg)",
        "purpose": "Primary therapeutic action",
        "description": "Detailed explanation of how it works"
      }
    ]
  },
  "alternatives": [
    {
      "name": "Ayurvedic herb/remedy name (Sanskrit/Common name)",
      "type": "e.g., Herb, Formulation, Powder, Decoction",
      "addresses": "Which medicine content/symptom this replaces",
      "dosage": {
        "amount": "e.g., 1-2 teaspoons, 500mg, 3-5 grams",
        "frequency": "e.g., Twice daily, Three times a day",
        "timing": "e.g., After meals, Empty stomach, Before bed",
        "preparation": "How to prepare (e.g., Mix with warm water, honey, milk)"
      },
      "description": "Detailed benefits and how it works in Ayurvedic terms",
      "benefits": [
        "Specific benefit 1",
        "Specific benefit 2",
        "Specific benefit 3"
      ],
      "precautions": "Any contraindications or warnings"
    }
  ]
}

IMPORTANT INSTRUCTIONS:
1. Provide SPECIFIC dosages with units (mg, grams, teaspoons, etc.)
2. Include detailed preparation methods
3. Specify exact timing (morning/evening, with food, etc.)
4. List at least 3-4 specific benefits for each alternative
5. Include Sanskrit names where applicable
6. Add precautions for pregnancy, children, or specific conditions
7. Be precise with measurements and frequencies
8. If symptoms are given, provide remedies for those symptoms with full dosage details

Keep all information accurate, practical, and safely applicable.`;

    let messages;
    
    if (typeof userMessage === 'string') {
        // Text input
        messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];
    } else {
        // Image input - using vision model
        messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${userMessage.image}`
                        }
                    },
                    {
                        type: 'text',
                        text: userMessage.text
                    }
                ]
            }
        ];
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: typeof userMessage === 'string' ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: messages,
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return JSON.parse(content);
}

// Display results with detailed structure
function displayResults(data) {
    const medicineContent = document.getElementById('medicineContent');
    const ayurvedicContent = document.getElementById('ayurvedicContent');
    
    // Display medicine analysis
    if (data.medicine && data.medicine.name) {
        let medicineHTML = `
            <div class="medicine-name">${data.medicine.name}</div>
            ${data.medicine.category ? `<div class="medicine-category">Category: ${data.medicine.category}</div>` : ''}
        `;
        
        if (data.medicine.contents && data.medicine.contents.length > 0) {
            data.medicine.contents.forEach(content => {
                medicineHTML += `
                    <div class="content-item">
                        <div class="content-header">
                            <div class="content-name">${content.name}</div>
                            ${content.dosage ? `<div class="content-dosage">${content.dosage}</div>` : ''}
                        </div>
                        ${content.purpose ? `<div class="content-purpose">Purpose: ${content.purpose}</div>` : ''}
                        <div class="content-desc">${content.description}</div>
                    </div>
                `;
            });
        }
        
        medicineContent.innerHTML = medicineHTML;
    } else {
        medicineContent.innerHTML = '<div class="content-desc">Analyzing symptoms for Ayurvedic remedies</div>';
    }
    
    // Display Ayurvedic alternatives with detailed dosage
    if (data.alternatives && data.alternatives.length > 0) {
        let alternativesHTML = '';
        
        data.alternatives.forEach(alt => {
            alternativesHTML += `
                <div class="alternative-item">
                    <div class="alt-header">
                        <div class="alt-name">${alt.name}</div>
                        ${alt.type ? `<div class="alt-type">${alt.type}</div>` : ''}
                    </div>
                    
                    <div class="alt-addresses">
                        <div class="alt-label">Addresses:</div>
                        <div class="alt-content">${alt.addresses}</div>
                    </div>
            `;
            
            // Dosage section
            if (alt.dosage) {
                alternativesHTML += `
                    <div class="alt-dosage-section">
                        <div class="dosage-title">📋 Dosage & Administration:</div>
                        ${alt.dosage.amount ? `
                            <div class="dosage-item">
                                <span class="dosage-label">Amount:</span>
                                <span class="dosage-value">${alt.dosage.amount}</span>
                            </div>
                        ` : ''}
                        ${alt.dosage.frequency ? `
                            <div class="dosage-item">
                                <span class="dosage-label">Frequency:</span>
                                <span class="dosage-value">${alt.dosage.frequency}</span>
                            </div>
                        ` : ''}
                        ${alt.dosage.timing ? `
                            <div class="dosage-item">
                                <span class="dosage-label">Timing:</span>
                                <span class="dosage-value">${alt.dosage.timing}</span>
                            </div>
                        ` : ''}
                        ${alt.dosage.preparation ? `
                            <div class="dosage-item">
                                <span class="dosage-label">Preparation:</span>
                                <span class="dosage-value">${alt.dosage.preparation}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            // Description
            alternativesHTML += `<div class="alt-desc">${alt.description}</div>`;
            
            // Benefits
            if (alt.benefits && alt.benefits.length > 0) {
                alternativesHTML += `
                    <div class="alt-benefits">
                        <div class="benefits-title">✨ Key Benefits:</div>
                `;
                alt.benefits.forEach(benefit => {
                    alternativesHTML += `<div class="benefit-item">${benefit}</div>`;
                });
                alternativesHTML += `</div>`;
            }
            
            // Precautions
            if (alt.precautions) {
                alternativesHTML += `
                    <div class="precautions">
                        <div class="precautions-title">⚠️ Precautions:</div>
                        <div class="precaution-text">${alt.precautions}</div>
                    </div>
                `;
            }
            
            alternativesHTML += `</div>`;
        });
        
        ayurvedicContent.innerHTML = alternativesHTML;
    } else {
        ayurvedicContent.innerHTML = '<div class="alt-desc">No alternatives found</div>';
    }
    
    document.getElementById('results').classList.add('active');
}

// UI Helper functions
function showLoading() {
    document.getElementById('loading').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

function hideError() {
    document.getElementById('error').classList.remove('active');
}

function hideResults() {
    document.getElementById('results').classList.remove('active');
}

// Drag and drop support
const fileInputWrapper = document.querySelector('.file-input-wrapper');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileInputWrapper.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    fileInputWrapper.addEventListener(eventName, () => {
        fileInputWrapper.style.background = '#c8e6c9';
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileInputWrapper.addEventListener(eventName, () => {
        fileInputWrapper.style.background = '#f1f8e9';
    }, false);
});

fileInputWrapper.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        document.getElementById('fileInput').files = files;
        handleFileSelect({ target: { files: files } });
    }
}, false);
