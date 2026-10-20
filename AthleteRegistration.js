// AthleteRegistration.js
import React, { useState, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, Modal, Alert, Image 
} from 'react-native';

const translations = {
  English: {
    createId: "Create Your Arena ID",
    tagline: "BEYOND GAME, TOTAL BAWAAL",
    userIdentity: "0. User Identity (e.g. Football Lover)",
    userIdentityPlaceholder: "Choose your display identity",
    fullName: "1. Full Name (Real Name)",
    fullNamePlaceholder: "Enter real name",
    mobile: "4. Mobile Number",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. Email ID (Optional)",
    emailPlaceholder: "name@example.com",
    sport: "7. Sport / Adventure (Feed Filter)",
    sportPlaceholder: "e.g. Football, MMA, Boxing",
    terms: "I have read and agree to the ",
    termsLink: "Terms & Conditions",
    buttonText: "Enter the Arena - Let's Go",
    verifyOtp: "Verify OTP",
    otpDesc: "Enter the 6-digit code sent to your mobile",
    enterBawaal: "Enter Bawaal",
    termsTitle: "BAWAAL DIGITAL ARENA - OFFICIAL USER AGREEMENT",
    termsContent: `1. ACCOUNT ELIGIBILITY & AUTHENTICITY:
By creating an Arena ID on Bawaal, you represent that all registration details are authentic. Accounts utilizing deceptive identities or impersonating others are subject to immediate termination.

2. ATHLETE ETHICS & CODE OF CONDUCT:
Zero tolerance for hate speech, cyberbullying, harassment, or abusive commentary. Violations result in permanent bans.

3. CONTENT & MEDIA OWNERSHIP:
You retain complete legal ownership of original media uploaded to Bawaal, granting the platform a non-exclusive license to feature content in community feeds.

4. PRIVACY & MOBILE VERIFICATION:
Phone numbers are used strictly for OTP authentication and are never shared publicly.

5. DIGITAL ARENA ROOMS & FEEDS:
Participation in sports feeds is governed by community moderation.

6. LIMITATION OF LIABILITY:
Bawaal is a digital platform and is not liable for independent physical events.

7. MODIFICATIONS TO TERMS:
Bawaal reserves the right to update these terms to maintain arena integrity.`
  },
  Hindi: {
    createId: "अपनी एरिना आईडी बनाएं",
    tagline: "खेल से परे, कुल बवाल",
    userIdentity: "0. उपयोगकर्ता पहचान (जैसे फुटबॉल प्रेमी)",
    userIdentityPlaceholder: "अपनी पहचान चुनें",
    fullName: "1. पूरा नाम (वास्तविक नाम)",
    fullNamePlaceholder: "वास्तविक नाम दर्ज करें",
    mobile: "4. मोबाइल नंबर",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. ईमेल आईडी (वैकल्पिक)",
    emailPlaceholder: "name@example.com",
    sport: "7. खेल / एडवेंचर",
    sportPlaceholder: "जैसे फुटबॉल, एमएमए, बॉक्सिंग",
    terms: "मैंने पढ़ा है और सहमत हूँ ",
    termsLink: "नियम और शर्तें",
    buttonText: "एरिना में प्रवेश करें",
    verifyOtp: "ओटीपी सत्यापित करें",
    otpDesc: "अपने मोबाइल पर प्राप्त 6-अंकों का कोड दर्ज करें",
    enterBawaal: "बवाल दर्ज करें",
    termsTitle: "बवाल डिजिटल एरिना - आधिकारिक उपयोगकर्ता समझौता",
    termsContent: `1. खाता पात्रता और प्रामाणिकता:
बवाल पर एरिना आईडी बनाकर, आप घोषणा करते हैं कि सभी विवरण प्रामाणिक हैं। फर्जी प्रोफाइल तुरंत ब्लॉक कर दी जाएगी।

2. एथलीट आचार संहिता:
घृणास्पद भाषण, उत्पीड़न या गाली-गलौज के खिलाफ सख्त कार्रवाई की जाएगी।

3. सामग्री और मीडिया स्वामित्व:
आप अपने अपलोड किए गए स्पोर्ट्स मीडिया के पूर्ण मालिक बने रहेंगे।

4. गोपनीयता और मोबाइल सत्यापन:
आपका फोन नंबर केवल ओटीपी सत्यापन के लिए उपयोग किया जाता है।

5. डिजिटल एरिना और फीड:
सामग्री का संचालन सामुदायिक नियमों द्वारा किया जाता है।

6. दायित्व की सीमा:
बवाल किसी भी व्यक्तिगत शारीरिक खेल आयोजनों के लिए उत्तरदायी नहीं है।

7. शर्तों में संशोधन:
बवाल के पास इन नियमों को अपडेट करने का अधिकार सुरक्षित है।`
  },
  Spanish: {
    createId: "Crea tu ID de Arena",
    tagline: "MÁS ALLÁ DEL JUEGO, TOTAL BAWAAL",
    userIdentity: "0. Identidad de usuario",
    userIdentityPlaceholder: "Elige tu identidad",
    fullName: "1. Nombre completo",
    fullNamePlaceholder: "Ingresa tu nombre real",
    mobile: "4. Número de móvil",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. Correo electrónico (Opcional)",
    emailPlaceholder: "name@example.com",
    sport: "7. Deporte / Aventura",
    sportPlaceholder: "ej. Fútbol, MMA, Boxeo",
    terms: "He leído y acepto los ",
    termsLink: "Términos y Condiciones",
    buttonText: "Entrar a la Arena",
    verifyOtp: "Verificar OTP",
    otpDesc: "Ingresa el código de 6 dígitos enviado a tu móvil",
    enterBawaal: "Entrar a Bawaal",
    termsTitle: "ARENA DIGITAL BAWAAL - ACUERDO OFICIAL DE USUARIO",
    termsContent: `1. ELEGIBILIDAD Y AUTENTICIDAD DE LA CUENTA:
Al crear una ID en Bawaal, declaras que todos los datos son auténticos. Las cuentas falsas serán suspendidas.

2. CÓDIGO DE CONDUCTA ATLETICA:
Tolerancia cero contra el acoso, discurso de odio o abusos.

3. PROPIEDAD DEL CONTENIDO:
Mantienes la propiedad total de tus videos e imágenes deportivas subidas.

4. PRIVACIDAD Y VERIFICACIÓN MÓVIL:
Tu número telefónico se utiliza únicamente para verificación por OTP.

5. SALAS DE ARENA DIGITAL:
La participación se rige por las reglas comunitarias de moderación.

6. LIMITACIÓN DE RESPONSABILIDAD:
Bawaal no se responsabiliza por eventos deportivos físicos independientes.

7. MODIFICACIONES DE TÉRMINOS:
Bawaal se reserva el derecho de actualizar estos términos.`
  },
  French: {
    createId: "Créez votre ID d'arène",
    tagline: "AU-DELÀ DU JEU, TOTAL BAWAAL",
    userIdentity: "0. Identité d'utilisateur",
    userIdentityPlaceholder: "Choisissez votre identité",
    fullName: "1. Nom complet",
    fullNamePlaceholder: "Entrez votre vrai nom",
    mobile: "4. Numéro de mobile",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. E-mail (Optionnel)",
    emailPlaceholder: "name@example.com",
    sport: "7. Sport / Aventure",
    sportPlaceholder: "ex. Football, MMA, Boxe",
    terms: "J'ai lu et j'accepte les ",
    termsLink: "Termes et Conditions",
    buttonText: "Entrer dans l'Arène",
    verifyOtp: "Vérifier l'OTP",
    otpDesc: "Entrez le code à 6 chiffres envoyé sur votre mobile",
    enterBawaal: "Entrer dans Bawaal",
    termsTitle: "BAWAAL DIGITAL ARENA - ACCORD UTILISATEUR OFFICIEL",
    termsContent: `1. ÉLIGIBILITÉ ET AUTHENTICITÉ DU COMPTE:
En créant un ID Arena sur Bawaal, vous garantissez que vos informations sont authentiques. Les faux profils seront supprimés.

2. ÉTHIQUE ET CODE DE CONDUITE DES ATHLÈTES:
Tolérance zéro contre les discours de haine, le harcèlement ou les abus.

3. PROPRIÉTÉ DU CONTENU ET DES MÉDIAS:
Vous conservez la propriété de vos vidéos et images de sport publiées.

4. CONFIDENTIALITÉ ET VÉRIFICATION MOBILE:
Votre numéro de téléphone sert uniquement à la vérification OTP.

5. FEEDS ET SALLES D'ARÈNE DIGITALE:
La modération communautaire s'applique à tous les flux.

6. LIMITATION DE RESPONSABILITÉ:
Bawaal n'est pas responsable des événements sportifs physiques organisés séparément.

7. MODIFICATIONS DES CONDITIONS:
Bawaal se réserve le droit de modifier ces conditions à tout moment.`
  },
  Japanese: {
    createId: "アリーナIDを作成",
    tagline: "ゲームを超えて、完全なバワール",
    userIdentity: "0. ユーザーID",
    userIdentityPlaceholder: "表示名を選択",
    fullName: "1. 氏名（本名）",
    fullNamePlaceholder: "本名を入力",
    mobile: "4. 携帯電話番号",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. メールアドレス（任意）",
    emailPlaceholder: "name@example.com",
    sport: "7. スポーツ / アドベンチャー",
    sportPlaceholder: "例: サッカー、MMA、ボクシング",
    terms: "以下に同意します: ",
    termsLink: "利用規約",
    buttonText: "アリーナに入る",
    verifyOtp: "OTP確認",
    otpDesc: "携帯電話に送信された6桁のコードを入力してください",
    enterBawaal: "バワールに入る",
    termsTitle: "BAWAAL デジタルアリーナ - 公式利用規約",
    termsContent: `1. アカウントの適格性と本物性:
登録情報が正確であることを保証してください。偽アカウントは停止されます。

2. アスリートの行動規範:
ハラスメントやヘイトスピーチに対する完全なゼロトレランス方針。

3. コンテンツの所有権:
投稿された動画や画像の所有権はユーザーに帰属します。

4. プライバシーと電話番号認証:
携帯番号はOTP認証のみに使用されます。

5. デジタルアリーナコミュニティ:
投稿はガイドラインに従ってモデレーションされます。

6. 責任の制限:
現実のスポーツ活動についてプラットフォームは責任を負いません。

7. 規約の変更:
規約は必要に応じて更新される場合があります。`
  },
  Thai: {
    createId: "สร้าง ID อารีน่าของคุณ",
    tagline: "เหนือกว่าเกม บาวาลเต็มพิกัด",
    userIdentity: "0. ไอดีผู้ใช้งาน",
    userIdentityPlaceholder: "เลือกชื่อที่แสดงของคุณ",
    fullName: "1. ชื่อ-นามสกุลจริง",
    fullNamePlaceholder: "ป้อนชื่อจริงของคุณ",
    mobile: "4. เบอร์มือถือ",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. อีเมล (ไม่บังคับ)",
    emailPlaceholder: "name@example.com",
    sport: "7. กีฬา / ผจญภัย",
    sportPlaceholder: "เช่น ฟุตบอล, MMA, มวย",
    terms: "ฉันได้อ่านและยอมรับ ",
    termsLink: "ข้อกำหนดและเงื่อนไข",
    buttonText: "เข้าสู่สนามประลอง",
    verifyOtp: "ยืนยันรหัส OTP",
    otpDesc: "กรอกรหัส 6 หลักที่ส่งไปยังมือถือของคุณ",
    enterBawaal: "เข้าสู่ Bawaal",
    termsTitle: "BAWAAL DIGITAL ARENA - ข้อตกลงผู้ใช้งานอย่างเป็นทางการ",
    termsContent: `1. คุณสมบัติและการยืนยันตัวตน:
ข้อมูลการสมัครต้องเป็นความจริง บัญชีปลอมจะถูกระงับทันที

2. จรรยาบรรณนักกีฬา:
ห้ามใช้คำพูดเกลียดชังหรือการคุกคามทุกรูปแบบ

3. สิทธิ์ในเนื้อหาและสื่อ:
คุณยังคงเป็นเจ้าของวิดีโอและรูปภาพกีฬาที่คุณอัปโหลด

4. ความเป็นส่วนตัวและการยืนยันมือถือ:
เบอร์มือถือใช้สำหรับยืนยัน OTP เท่านั้น

5. ห้องและฟีดอารีน่าดิจิทัล:
การร่วมสนุกอยู่ภายใต้การดูแลของชุมชน

6. ข้อจำกัดความรับผิดชอบ:
แพลตฟอร์มไม่รับผิดชอบต่อกิจกรรมทางกายภาพภายนอก

7. การปรับปรุงข้อตกลง:
ขอสงวนสิทธิ์ในการปรับปรุงข้อตกลงตามความเหมาะสม`
  },
  Italian: {
    createId: "Crea il tuo ID Arena",
    tagline: "OLTRE IL GIOCO, TOTAL BAWAAL",
    userIdentity: "0. Identità utente",
    userIdentityPlaceholder: "Scegli la tua identità",
    fullName: "1. Nome completo",
    fullNamePlaceholder: "Inserisci il nome reale",
    mobile: "4. Numero di cellulare",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. Email (Opzionale)",
    emailPlaceholder: "name@example.com",
    sport: "7. Sport / Avventura",
    sportPlaceholder: "es. Calcio, MMA, Boxe",
    terms: "Ho letto e accetto i ",
    termsLink: "Termini e Condizioni",
    buttonText: "Entra nell'Arena",
    verifyOtp: "Verifica OTP",
    otpDesc: "Inserisci il codice a 6 cifre inviato al tuo cellulare",
    enterBawaal: "Entra in Bawaal",
    termsTitle: "BAWAAL DIGITAL ARENA - ACCORDO UFFICIALE UTENTE",
    termsContent: `1. IDONEITÀ E AUTENTICITÀ DELL'ACCOUNT:
Garantisci che i dati inseriti siano autentici. Gli account falsi verranno sospesi.

2. ETICA E CODICE DI CONDOTTA:
Tolleranza zero contro molestie o incitamento all'odio.

3. PROPRIETÀ DEI CONTENUTI:
Mantieni la piena proprietà dei video e foto sportive pubblicate.

4. PRIVACY E VERIFICA MOBILE:
Il numero di telefono è utilizzato esclusivamente per l'OTP.

5. FEED E STANZE ARENA:
Tutti i contenuti sono soggetti a moderazione.

6. LIMITAZIONE DI RESPONSABILITÀ:
Bawaal non è responsabile per eventi sportivi fisici esterni.

7. MODIFICHE AI TERMINI:
Ci riserviamo il diritto di aggiornare questi termini.`
  },
  German: {
    createId: "Erstelle deine Arena-ID",
    tagline: "JENSEITS DES SPIELS, TOTAL BAWAAL",
    userIdentity: "0. Benutzeridentität",
    userIdentityPlaceholder: "Wähle deine Identität",
    fullName: "1. Vollständiger Name",
    fullNamePlaceholder: "Echten Namen eingeben",
    mobile: "4. Handynummer",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. E-Mail (Optional)",
    emailPlaceholder: "name@example.com",
    sport: "7. Sport / Abenteuer",
    sportPlaceholder: "z.B. Fußball, MMA, Boxen",
    terms: "Ich habe die ",
    termsLink: "Geschäftsbedingungen",
    buttonText: "Betrete die Arena",
    verifyOtp: "OTP Verifizieren",
    otpDesc: "Gib den 6-stelligen Code ein, der an dein Handy gesendet wurde",
    enterBawaal: "Bawaal Betreten",
    termsTitle: "BAWAAL DIGITAL ARENA - OFFIZIELLE BENUTZERVEREINBARUNG",
    termsContent: `1. KONTOELIGIBILITÄT UND AUTHENTIZITÄT:
Alle Registrierungsangaben müssen der Wahrheit entsprechen.

2. VERHALTENSKODEX FÜR ATHLETEN:
Keine Toleranz gegenüber Hassrede, Mobbing oder Beschimpfungen.

3. URHEBERRECHT AN MEDIEN:
Du behältst die Rechte an deinen hochgeladenen Sportvideos und Bildern.

4. DATENSCHUTZ UND VERIFIZIERUNG:
Handynummern dienen rein der OTP-Authentifizierung.

5. DIGITALE ARENA-FEEDS:
Die Teilnahme unterliegt der Community-Moderation.

6. HAFTUNGSBESCHRÄNKUNG:
Bawaal haftet nicht für externe physische Sportaktivitäten.

7. ÄNDERUNGEN DER BEDINGUNGEN:
Bawaal behält sich das Recht vor, diese Regeln anzupassen.`
  },
  Filipino: {
    createId: "Gumawa ng iyong Arena ID",
    tagline: "HIGIT SA LARO, TOTAL BAWAAL",
    userIdentity: "0. Pagkakakilanlan ng User",
    userIdentityPlaceholder: "Piliin ang iyong display identity",
    fullName: "1. Buong Pangalan",
    fullNamePlaceholder: "Ilagay ang totoong pangalan",
    mobile: "4. Numero ng Mobile",
    mobilePlaceholder: "+91 xxxxxxxxxx",
    email: "5. Email (Opsyonal)",
    emailPlaceholder: "name@example.com",
    sport: "7. Isports / Adventure",
    sportPlaceholder: "hal. Football, MMA, Boxing",
    terms: "Nabasa ko at sumasang-ayon ako sa mga ",
    termsLink: "Tuntunin at Kundisyon",
    buttonText: "Pumasok sa Arena",
    verifyOtp: "I-verify ang OTP",
    otpDesc: "Ilagay ang 6-digit code na ipinadala sa iyong mobile",
    enterBawaal: "Pumasok sa Bawaal",
    termsTitle: "BAWAAL DIGITAL ARENA - OPISYAL NA KASUNDUAN NG USER",
    termsContent: `1. KWALPIKASYON AT KATOTOHANAN NG ACCOUNT:
Lahat ng impormasyong ibibigay ay dapat totoo. Ang mga pekeng account ay tatanggalin.

2. ETIKA AT KODIGO NG PAG-UUGALI NG ATLETA:
Bawal ang anumang uri ng pambu-bully o hate speech.

3. PAGMAMAY-ARI NG LIKHA AT MEDIA:
Nasa sa iyo pa rin ang buong karapatan sa mga sports video at larawang i-upload mo.

4. PRIBASYO AT PAG-VERIFY NG MOBILE:
Ang numero ay ginagamit lamang para sa OTP authentication.

5. MGA FEED AT SILID SA DIGITAL ARENA:
Ang lahat ng post ay sumasailalim sa alituntunin ng komunidad.

6. LIMITASYON NG PANANAGUTAN:
Walang pananagutan ang Bawaal sa mga pisikal na laro sa labas ng app.

7. PAGBABAGO SA MGA TUNTUNIN:
May karapatan ang Bawaal na i-update ang mga tuntuning ito.`
  }
};

export default function AthleteRegistration({ navigation }) {
  const countries = [
    '🇮🇳 India', '🇺🇸 USA', '🇬🇧 UK', '🇯🇵 Japan', '🇦🇺 Australia', 
    '🇨🇦 Canada', '🇧🇷 Brazil', '🇳🇿 New Zealand', '🇵🇭 Philippines', 
    '🇦🇷 Argentina', '🇩🇪 Germany', '🇫🇷 France', '🇪🇸 Spain', '🇦🇪 UAE'
  ];
  
  const languages = ['English', 'Hindi', 'Spanish', 'French', 'Japanese', 'Thai', 'Italian', 'German', 'Filipino'];

  const [country, setCountry] = useState('🇮🇳 India');
  const [language, setLanguage] = useState('English');
  const [agreed, setAgreed] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  
  const [userIdentity, setUserIdentity] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [sport, setSport] = useState('');

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const t = translations[language] || translations['English'];

  const handleSubmit = () => {
    if (!userIdentity || !fullName || !mobile || !sport) {
      Alert.alert('Missing Fields', 'Please fill in all mandatory fields.');
      return;
    }
    if (!agreed) {
      Alert.alert('Terms & Conditions', 'Please agree to the Terms & Conditions to proceed.');
      return;
    }
    setShowOtpModal(true);
  };

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtp = () => {
    if (otp.join('').length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code.');
      return;
    }
    setShowOtpModal(false);
    Alert.alert('Success!', 'Welcome to Bawaal Arena!');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          
          <View style={styles.topHeader}>
            <View style={styles.brandGroup}>
              <Image 
                source={require('./assets/bawaal_bolder_larger.png')} 
                style={styles.logoEmblem} 
                resizeMode="contain" 
              />
              <Image 
                source={require('./assets/bawaal_line.png')} 
                style={styles.logoLineText} 
                resizeMode="contain" 
              />
            </View>
            <View style={styles.metaGroup}>
              <TouchableOpacity style={styles.metaBadge} onPress={() => setShowCountryModal(true)} activeOpacity={0.7}>
                <Text style={styles.metaText}>{country} ▼</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.metaBadge} onPress={() => setShowLangModal(true)} activeOpacity={0.7}>
                <Text style={styles.metaText}>{language} ▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerTitleArea}>
            <Text style={styles.tagline}>{t.tagline}</Text>
            <Text style={styles.title}>{t.createId}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t.userIdentity}</Text>
            <TextInput 
              style={[styles.input, focusedInput === 0 && styles.inputFocused]} placeholder={t.userIdentityPlaceholder} placeholderTextColor="#8A96B5"
              value={userIdentity} onChangeText={setUserIdentity} onFocus={() => setFocusedInput(0)} onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.label}>{t.fullName}</Text>
            <TextInput 
              style={[styles.input, focusedInput === 1 && styles.inputFocused]} placeholder={t.fullNamePlaceholder} placeholderTextColor="#8A96B5"
              value={fullName} onChangeText={setFullName} onFocus={() => setFocusedInput(1)} onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.label}>{t.mobile}</Text>
            <TextInput 
              style={[styles.input, focusedInput === 4 && styles.inputFocused]} placeholder={t.mobilePlaceholder} placeholderTextColor="#8A96B5" keyboardType="phone-pad"
              value={mobile} onChangeText={setMobile} onFocus={() => setFocusedInput(4)} onBlur={() => setFocusedInput(null)}
            />

            <Text style={styles.label}>{t.email}</Text>
            <TextInput 
              style={[styles.input, focusedInput === 5 && styles.inputFocused]} placeholder={t.emailPlaceholder} placeholderTextColor="#8A96B5" keyboardType="email-address"
              value={email} onChangeText={setEmail} onFocus={() => setFocusedInput(5)} onBlur={() => setFocusedInput(null)}
            />

            <Text style={[styles.label, { color: '#E5E4E2', fontWeight: '700' }]}>{t.sport}</Text>
            <TextInput 
              style={[styles.input, focusedInput === 7 ? styles.inputFocused : { borderColor: '#E5E4E255' }]} placeholder={t.sportPlaceholder} placeholderTextColor="#8A96B5"
              value={sport} onChangeText={setSport} onFocus={() => setFocusedInput(7)} onBlur={() => setFocusedInput(null)}
            />

            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAgreed(!agreed)} activeOpacity={0.8}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                {t.terms}
                <Text style={{ color: '#E5E4E2', textDecorationLine: 'underline' }} onPress={() => setShowTermsModal(true)}>
                  {t.termsLink}
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.btnText}>{t.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Country Selection Modal */}
      <Modal visible={showCountryModal} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCountryModal(false)}>
          <View style={styles.dropdownCard}>
            <Text style={styles.dropdownTitle}>Select Country</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {countries.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.dropdownOption} onPress={() => { setCountry(item); setShowCountryModal(false); }}>
                  <Text style={styles.dropdownOptionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Language Selection Modal */}
      <Modal visible={showLangModal} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowLangModal(false)}>
          <View style={styles.dropdownCard}>
            <Text style={styles.dropdownTitle}>Select Language</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {languages.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.dropdownOption} onPress={() => { setLanguage(item); setShowLangModal(false); }}>
                  <Text style={styles.dropdownOptionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fully Localized Terms & Conditions Modal */}
      <Modal visible={showTermsModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <Text style={styles.modalTitle}>{t.termsLink}</Text>
            <ScrollView style={{ marginVertical: 12 }} showsVerticalScrollIndicator={true}>
              <Text style={{ color: '#E5E4E2', fontWeight: 'bold', fontSize: 13, marginBottom: 10 }}>
                {t.termsTitle}
              </Text>
              <Text style={{ color: '#8A96B5', fontSize: 13, lineHeight: 20 }}>
                {t.termsContent}
              </Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.btnPrimary} 
              onPress={() => {
                setAgreed(true);
                setShowTermsModal(false);
              }}
            >
              <Text style={styles.btnText}>Accept & Agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal visible={showOtpModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image 
              source={require('./assets/bawaal_bolder_larger.png')} 
              style={styles.otpModalLogo} 
              resizeMode="contain" 
            />
            <Text style={styles.modalTitle}>{t.verifyOtp}</Text>
            <Text style={styles.modalDesc}>{t.otpDesc}</Text>
            <View style={styles.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <TextInput
                  key={index} ref={(el) => (otpRefs.current[index] = el)} maxLength={1} keyboardType="numeric"
                  style={[styles.otpBox, focusedInput === `otp_${index}` && styles.inputFocused]}
                  value={otp[index]} onChangeText={(val) => handleOtpChange(val, index)}
                  onFocus={() => setFocusedInput(`otp_${index}`)} onBlur={() => setFocusedInput(null)}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleVerifyOtp}>
              <Text style={styles.btnText}>{t.enterBawaal}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050A16' },
  scrollContainer: { padding: 16, justifyContent: 'center', minHeight: '100%' },
  card: { backgroundColor: '#0E152B', borderRadius: 18, borderWidth: 1, borderColor: '#1E2A4A', padding: 20 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1E2A4A', paddingBottom: 12, marginBottom: 16 },
  brandGroup: { flexDirection: 'row', alignItems: 'center' },
  logoEmblem: { width: 32, height: 32, marginRight: 6 },
  logoLineText: { width: 85, height: 26 },
  otpModalLogo: { width: 90, height: 90, marginBottom: 14 },
  metaGroup: { flexDirection: 'row', alignItems: 'center' },
  metaBadge: { backgroundColor: '#111D33', borderWidth: 1, borderColor: '#1E2A4A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6 },
  metaText: { fontSize: 11, color: '#8A96B5', fontWeight: '600' },
  headerTitleArea: { alignItems: 'center', marginBottom: 16 },
  tagline: { fontSize: 10, fontWeight: '700', color: '#E5E4E2', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  form: { width: '100%' },
  label: { fontSize: 11, color: '#8A96B5', marginBottom: 4, fontWeight: '600', marginTop: 12 },
  input: { backgroundColor: '#111D33', borderWidth: 1, borderColor: '#1E2A4A', borderRadius: 12, padding: 10, color: '#FFFFFF', fontSize: 14 },
  inputFocused: { borderColor: '#E5E4E2', shadowColor: '#E5E4E2', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, paddingRight: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#1E2A4A', backgroundColor: '#111D33', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#E5E4E2', borderColor: '#E5E4E2' },
  termsText: { fontSize: 12, color: '#8A96B5', flex: 1, lineHeight: 18 },
  btnPrimary: { backgroundColor: '#E5E4E2', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, width: '100%' },
  btnText: { color: '#05070A', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 10, 22, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: '#0E152B', borderRadius: 18, borderWidth: 1, borderColor: '#1E2A4A', padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4, textAlign: 'center' },
  modalDesc: { fontSize: 12, color: '#8A96B5', marginBottom: 20, textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  otpBox: { width: 44, height: 50, backgroundColor: '#111D33', borderWidth: 1, borderColor: '#1E2A4A', borderRadius: 10, color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  dropdownCard: { width: '80%', backgroundColor: '#0E152B', borderRadius: 16, borderWidth: 1, borderColor: '#1E2A4A', padding: 16 },
  dropdownTitle: { fontSize: 14, fontWeight: '700', color: '#E5E4E2', marginBottom: 12, textAlign: 'center' },
  dropdownOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E2A4A' },
  dropdownOptionText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});