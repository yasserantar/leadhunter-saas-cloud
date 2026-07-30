const fs = require('fs');

const queryDropdown = `                                <select id="query-select" onchange="if(this.value==='custom') { document.getElementById('scrape-query').classList.remove('hidden'); document.getElementById('scrape-query').value=''; document.getElementById('scrape-query').focus(); } else { document.getElementById('scrape-query').classList.add('hidden'); document.getElementById('scrape-query').value = this.value; }" class="w-full bg-apple-bg border border-apple-border rounded-xl px-4 py-3.5 text-apple-text focus:outline-none focus:border-apple-blue focus:bg-white font-medium">
                                    <option value="" disabled selected>اختر المجال بدقة...</option>
                                    <optgroup label="التسويق والتصميم والبرمجة">
                                        <option value="وكالات الدعاية والإعلان">وكالات الدعاية والإعلان</option>
                                        <option value="شركات التسويق الرقمي">شركات التسويق الرقمي</option>
                                        <option value="استوديوهات التصميم الجرافيكي والكريتيف">استوديوهات التصميم الجرافيكي والكريتيف</option>
                                        <option value="شركات الإنتاج الفني والميديا">شركات الإنتاج الفني والميديا</option>
                                        <option value="شركات البرمجة وتصميم المواقع">شركات البرمجة وتصميم المواقع</option>
                                    </optgroup>
                                    <optgroup label="الطب والرعاية الصحية">
                                        <option value="عيادات أسنان">عيادات أسنان</option>
                                        <option value="مراكز تجميل وليزر">مراكز تجميل وليزر</option>
                                        <option value="مستشفيات ومراكز طبية">مستشفيات ومراكز طبية</option>
                                        <option value="صيدليات">صيدليات</option>
                                        <option value="عيادات بيطرية">عيادات بيطرية</option>
                                    </optgroup>
                                    <optgroup label="المقاولات والعقارات">
                                        <option value="شركات عقارات وتسويق عقاري">شركات عقارات وتسويق عقاري</option>
                                        <option value="شركات مقاولات وبناء">شركات مقاولات وبناء</option>
                                        <option value="مكاتب هندسية واستشارات">مكاتب هندسية واستشارات</option>
                                        <option value="شركات تشطيبات وديكور">شركات تشطيبات وديكور</option>
                                    </optgroup>
                                    <optgroup label="الضيافة والسياحة">
                                        <option value="مطاعم">مطاعم</option>
                                        <option value="مقاهي وكافيهات">مقاهي وكافيهات</option>
                                        <option value="فنادق ومنتجعات">فنادق ومنتجعات</option>
                                        <option value="شركات سياحة وسفر">شركات سياحة وسفر</option>
                                    </optgroup>
                                    <optgroup label="التعليم والخدمات">
                                        <option value="مراكز تدريب وتعليم">مراكز تدريب وتعليم</option>
                                        <option value="مدارس دولية وخاصة">مدارس دولية وخاصة</option>
                                        <option value="مكاتب محاماة واستشارات قانونية">مكاتب محاماة واستشارات قانونية</option>
                                        <option value="شركات شحن ولوجستيات">شركات شحن ولوجستيات</option>
                                    </optgroup>
                                    <optgroup label="أخرى">
                                        <option value="custom">✍️ مجال آخر (كتابة يدوية)</option>
                                    </optgroup>
                                </select>`;

const locationDropdown = `                                <select id="location-select" onchange="if(this.value==='custom') { document.getElementById('scrape-location').classList.remove('hidden'); document.getElementById('scrape-location').value=''; document.getElementById('scrape-location').focus(); } else { document.getElementById('scrape-location').classList.add('hidden'); document.getElementById('scrape-location').value = this.value; }" class="w-full bg-apple-bg border border-apple-border rounded-xl px-4 py-3.5 text-apple-text focus:outline-none focus:border-apple-blue focus:bg-white font-medium">
                                    <option value="" disabled selected>اختر المدينة/الدولة...</option>
                                    <optgroup label="المملكة العربية السعودية">
                                        <option value="الرياض، السعودية">الرياض</option>
                                        <option value="جدة، السعودية">جدة</option>
                                        <option value="مكة المكرمة، السعودية">مكة المكرمة</option>
                                        <option value="المدينة المنورة، السعودية">المدينة المنورة</option>
                                        <option value="الدمام، السعودية">الدمام</option>
                                        <option value="الخبر، السعودية">الخبر</option>
                                        <option value="الطائف، السعودية">الطائف</option>
                                        <option value="تبوك، السعودية">تبوك</option>
                                    </optgroup>
                                    <optgroup label="الإمارات العربية المتحدة">
                                        <option value="دبي، الإمارات">دبي</option>
                                        <option value="أبوظبي، الإمارات">أبوظبي</option>
                                        <option value="الشارقة، الإمارات">الشارقة</option>
                                        <option value="عجمان، الإمارات">عجمان</option>
                                        <option value="رأس الخيمة، الإمارات">رأس الخيمة</option>
                                    </optgroup>
                                    <optgroup label="جمهورية مصر العربية">
                                        <option value="القاهرة، مصر">القاهرة</option>
                                        <option value="الجيزة، مصر">الجيزة</option>
                                        <option value="الإسكندرية، مصر">الإسكندرية</option>
                                        <option value="المنصورة، مصر">المنصورة</option>
                                        <option value="طنطا، مصر">طنطا</option>
                                        <option value="شرم الشيخ، مصر">شرم الشيخ</option>
                                    </optgroup>
                                    <optgroup label="دول الخليج الأخرى">
                                        <option value="الدوحة، قطر">الدوحة، قطر</option>
                                        <option value="الكويت، الكويت">الكويت</option>
                                        <option value="المنامة، البحرين">المنامة، البحرين</option>
                                        <option value="مسقط، عمان">مسقط، عمان</option>
                                    </optgroup>
                                    <optgroup label="دول عربية أخرى">
                                        <option value="عمان، الأردن">عمان، الأردن</option>
                                        <option value="بيروت، لبنان">بيروت، لبنان</option>
                                        <option value="الدار البيضاء، المغرب">الدار البيضاء، المغرب</option>
                                        <option value="تونس، تونس">تونس، تونس</option>
                                        <option value="الجزائر، الجزائر">الجزائر، الجزائر</option>
                                        <option value="بغداد، العراق">بغداد، العراق</option>
                                    </optgroup>
                                    <optgroup label="أخرى">
                                        <option value="custom">✍️ مدينة/دولة أخرى (كتابة)</option>
                                    </optgroup>
                                </select>`;

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Regex to match the entire select tag for query
    content = content.replace(/<select id="query-select"[^>]*>[\s\S]*?<\/select>/, queryDropdown);
    // Regex to match the entire select tag for location
    content = content.replace(/<select id="location-select"[^>]*>[\s\S]*?<\/select>/, locationDropdown);
    
    fs.writeFileSync(filePath, content);
    console.log("Updated", filePath);
}

updateFile('public/app.html');
updateFile('public/admin.html');
