const { GoogleGenerativeAI } = require('@google/generative-ai');

// دالة مبدئية لتوليد الـ AI
const getAiModel = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in .env file. Please add it to use AI features.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

/**
 * دراسة السوق وتحليل المنافسين
 */
const generateMarketResearch = async (keyword, location) => {
    try {
        const model = getAiModel();
        const prompt = `أنت خبير تسويق استراتيجي ومحلل أعمال محترف. 
        العميل يبحث عن الداتا الخاصة بـ "${keyword}" في "${location}".
        
        قم بعمل دراسة جدوى مبسطة تشمل:
        1. حجم السوق والطلب المتوقع.
        2. أبرز نقاط القوة والضعف في هذا المجال.
        3. استراتيجية تسويق مقترحة لاستهداف هؤلاء العملاء (B2B).
        4. أفكار لبوستات وحملات إعلانية.
        
        يجب أن يكون الرد منسقاً بتنسيق Markdown.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('AI Market Research Error:', error);
        throw error;
    }
};

/**
 * إنشاء رسالة تسويقية مخصصة (Personalized Message)
 */
const generatePersonalizedMessage = async (leadDetails, productDetails) => {
    try {
        const model = getAiModel();
        const prompt = `أنت خبير مبيعات وتسويق (Copywriter) محترف.
        نريد إرسال رسالة واتساب للعميل التالي:
        الاسم: ${leadDetails.name || 'عميل'}
        المجال: ${leadDetails.category || 'غير محدد'}
        
        نحن نبيع المنتج/الخدمة التالية:
        ${productDetails}
        
        اكتب رسالة واتساب جذابة، احترافية، ومختصرة جداً (لا تزيد عن 4 سطور).
        يجب أن تبدأ باسمه إن وجد، وتربط كيف يمكن لمنتجنا أن يفيد مجاله تحديداً.
        لا تضع أي روابط (Links) في الرسالة، فقط اجعلها تفتح باب النقاش.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('AI Personalized Message Error:', error);
        throw error;
    }
};

/**
 * الرد الآلي بالذكاء الاصطناعي (Auto-Reply)
 */
const generateAutoReply = async (incomingMessage, productDetails, chatHistory) => {
    try {
        const model = getAiModel();
        const prompt = `أنت مساعد مبيعات ذكي ترد على استفسارات العملاء على الواتساب بخصوص منتجنا/خدمتنا:
        ${productDetails}
        
        العميل أرسل: "${incomingMessage}"
        
        سجل المحادثة السابق (إن وجد):
        ${chatHistory || 'لا يوجد'}
        
        اكتب رداً مناسباً، ودوداً، واحترافياً. إذا سأل العميل عن السعر أو التفاصيل، أجب بناءً على المعلومات المتاحة أو اخبره أنك ستحول طلبه للمختص إذا لم تكن تعرف.
        الرد يجب أن يكون قصيراً جداً ومناسباً للواتساب.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('AI Auto Reply Error:', error);
        throw error;
    }
};

module.exports = {
    generateMarketResearch,
    generatePersonalizedMessage,
    generateAutoReply
};
