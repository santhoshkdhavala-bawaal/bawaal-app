import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Modal, 
  FlatList 
} from 'react-native';

const dictionary = {
  English: {
    tagline: 'Beyond game, total bawaal',
    subTitle: "The World's Premier Digital Arena for Every Athlete, Fan & Scout",
    countryLabel: 'COUNTRY 🌐',
    languageLabel: 'LANGUAGE 💬',
    athleteTitle: 'ATHLETE',
    athleteQuote: '"CLAIM THE ARENA • Showcase Drills, Fights & Records"',
    athleteBtn: 'ENTER ARENA →',
    fanTitle: 'FAN',
    fanQuote: '"FRONT-ROW VIP • Unfiltered Live Streams & Gear Reviews"',
    fanBtn: 'JOIN CROWD →',
    scoutTitle: 'SCOUT',
    scoutQuote: '"TALENT RECRUITMENT • Verify Records & Sign Champions"',
    scoutBtn: 'HUNT TALENT →',
  },
  French: {
    tagline: 'Au-delà du jeu, bawaal total',
    subTitle: "La première arène numérique mondiale pour chaque athlète, supporter et recruteur",
    countryLabel: 'PAYS 🌐',
    languageLabel: 'LANGUE 💬',
    athleteTitle: 'ATHLÈTE',
    athleteQuote: '"DOMINEZ L\'ARÈNE • Présentez vos entraînements, combats et records"',
    athleteBtn: 'ENTRER DANS L\'ARÈNE →',
    fanTitle: 'SUPPORTER',
    fanQuote: '"VIP PREMIER RANG • Directs sans filtre et avis sur le matériel"',
    fanBtn: 'REJOINDRE LA FOULE →',
    scoutTitle: 'RECRUTEUR',
    scoutQuote: '"RECRUTEMENT • Vérifiez les records et signez des champions"',
    scoutBtn: 'CHASSER LE TALENT →',
  },
  Italian: {
    tagline: 'Oltre il gioco, bawaal totale',
    subTitle: "La prima arena digitale al mondo per ogni atleta, tifoso e scout",
    countryLabel: 'PAESE 🌐',
    languageLabel: 'LINGUA 💬',
    athleteTitle: 'ATLETA',
    athleteQuote: '"CONQUISTA L\'ARENA • Mostra allenamenti, combattimenti e record"',
    athleteBtn: 'ENTRA NELL\'ARENA →',
    fanTitle: 'TIFOSO',
    fanQuote: '"VIP PRIMA FILA • Live stream senza filtri e recensioni outfit"',
    fanBtn: 'UNISCITI AI FAN →',
    scoutTitle: 'SCOUT',
    scoutQuote: '"RECLUTAMENTO TALENTI • Verifica record e ingaggia campioni"',
    scoutBtn: 'CERCA TALENTI →',
  },
  German: {
    tagline: 'Beyond game, total bawaal',
    subTitle: 'Die weltweit führende digitale Arena für jeden Athleten, Fan & Scout',
    countryLabel: 'LAND 🌐',
    languageLabel: 'SPRACHE 💬',
    athleteTitle: 'ATHLET',
    athleteQuote: '"EROBERE DIE ARENA • Zeige Drills, Kämpfe & Rekorde"',
    athleteBtn: 'ARENA BETRETEN →',
    fanTitle: 'FAN',
    fanQuote: '"VIP ERSTE REIHE • Ungefilterte Livestreams & Ausrüstungs-Reviews"',
    fanBtn: 'FAN-MENGE BEITRETEN →',
    scoutTitle: 'SCOUT',
    scoutQuote: '"TALENT-REKRUTIERUNG • Prüfe Rekorde & verpflichte Champions"',
    scoutBtn: 'TALENTE JAGEN →',
  },
  Spanish: {
    tagline: 'Más allá del juego, bawaal total',
    subTitle: "La principal arena digital del mundo para cada atleta, aficionado y ojeador",
    countryLabel: 'PAÍS 🌐',
    languageLabel: 'IDIOMA 💬',
    athleteTitle: 'ATLETA',
    athleteQuote: '"DOMINA LA ARENA • Muestra tus entrenamientos, peleas y récords"',
    athleteBtn: 'ENTRAR A LA ARENA →',
    fanTitle: 'AFICIONADO',
    fanQuote: '"VIP PRIMERA FILA • Transmisiones en vivo sin filtro y reseñas de equipo"',
    fanBtn: 'UNIRSE AL PÚBLICO →',
    scoutTitle: 'OJEADOR',
    scoutQuote: '"RECLUTAMIENTO • Verifica récords y firma campeones"',
    scoutBtn: 'BUSCAR TALENTO →',
  },
  Portuguese: {
    tagline: 'Além do jogo, bawaal total',
    subTitle: 'A principal arena digital do mundo para cada atleta, fã e olheiro',
    countryLabel: 'PAÍS 🌐',
    languageLabel: 'IDIOMA 💬',
    athleteTitle: 'ATLETA',
    athleteQuote: '"DOMINE A ARENA • Mostre treinos, lutas e recordes"',
    athleteBtn: 'ENTRAR NA ARENA →',
    fanTitle: 'FÃ',
    fanQuote: '"VIP PRIMEIRA FILEIRA • Lives sem filtro e avaliações de equipamentos"',
    fanBtn: 'JUNTAR-SE À TORCIDA →',
    scoutTitle: 'OLHEIRO',
    scoutQuote: '"RECRUTAMENTO DE TALENTOS • Verifique recordes e assine com campeões"',
    scoutBtn: 'PROCURAR TALENTOS →',
  },
  Tagalog: {
    tagline: 'Beyond game, total bawaal',
    subTitle: 'Ang nangungunang digital arena sa mundo para sa bawat atleta, tagahanga at scout',
    countryLabel: 'BANSA 🌐',
    languageLabel: 'WIKA 💬',
    athleteTitle: 'ATLETA',
    athleteQuote: '"ANGKININ ANG ARENA • Ipakita ang pagsasanay, laban at rekord"',
    athleteBtn: 'PUMASOK SA ARENA →',
    fanTitle: 'TAGA-HANGA',
    fanQuote: '"VIP UNANG LINYA • Unfiltered live streams at gear reviews"',
    fanBtn: 'PUMUNTA SA CROWD →',
    scoutTitle: 'SCOUT',
    scoutQuote: '"TALENT RECRUITMENT • Suriin ang mga rekord at pumirma ng kampeon"',
    scoutBtn: 'MAGHANAP NG TALENTO →',
  },
  Hindi: {
    tagline: 'Beyond game, total bawaal',
    subTitle: 'हर एथलीट, फैन और स्काउट के लिए दुनिया का नंबर 1 डिजिटल एरिना',
    countryLabel: 'देश 🌐',
    languageLabel: 'भाषा 💬',
    athleteTitle: 'एथलीट',
    athleteQuote: '"एरिना पर कब्ज़ा करो • अपनी ड्रिल्स, फाइट्स और रिकॉर्ड्स दिखाओ"',
    athleteBtn: 'एरिना में प्रवेश करें →',
    fanTitle: 'फैन',
    fanQuote: '"फ्रंट-रो वीआईपी • अनफिल्टर्ड लाइव स्ट्रीम और गियर रिव्यू"',
    fanBtn: 'क्राउड में शामिल हों →',
    scoutTitle: 'स्काउट',
    scoutQuote: '"टैलेंट रिक्रूटमेंट • रिकॉर्ड्स सत्यापित करें और चैंपियंस साइन करें"',
    scoutBtn: 'टैलेंट खोजें →',
  },
  Thai: {
    tagline: 'Beyond game, total bawaal',
    subTitle: 'เวทีดิจิทัลอันดับ 1 ของโลกสำหรับนักกีฬา แฟนคลับ และแมวมอง',
    countryLabel: 'ประเทศ 🌐',
    languageLabel: 'ภาษา 💬',
    athleteTitle: 'นักกีฬา',
    athleteQuote: '"ครองเวที • โชว์การซ้อม การชก และสถิติของคุณ"',
    athleteBtn: 'เข้าสู่เวที →',
    fanTitle: 'แฟนคลับ',
    fanQuote: '"VIP แถวหน้า • ไลฟ์สตรีมสด และรีวิวอุปกรณ์"',
    fanBtn: 'ร่วมเชียร์ →',
    scoutTitle: 'แมวมอง',
    scoutQuote: '"คัดตัวนักกีฬา • ตรวจสอบสถิติ และเซ็นสัญญาแชมป์"',
    scoutBtn: 'ค้นหานักกีฬา →',
  },
  Russian: {
    tagline: 'За пределами игры, полный bawaal',
    subTitle: 'Главная цифровая арена мира для каждого спортсмена, болельщика и скаута',
    countryLabel: 'СТРАНА 🌐',
    languageLabel: 'ЯЗЫК 💬',
    athleteTitle: 'СПОРТСМЕН',
    athleteQuote: '"ЗАВОЕВАЙ АРЕНУ • Показывай тренировки, бои и рекорды"',
    athleteBtn: 'ВОЙТИ НА АРЕНУ →',
    fanTitle: 'БОЛЕЛЬЩИК',
    fanQuote: '"VIP ПЕРВЫЙ РЯД • Прямые трансляции и обзоры экипировки"',
    fanBtn: 'ПРИСОЕДИНИТЬСЯ →',
    scoutTitle: 'СКАУТ',
    scoutQuote: '"ПОИСК ТАЛАНТОВ • Проверяй рекорды и подписывай чемпионов"',
    scoutBtn: 'ИСКАТЬ ТАЛАНТЫ →',
  },
  Japanese: {
    tagline: 'Beyond game, total bawaal',
    subTitle: 'すべてのアスリート、ファン、スカウトのための世界最高峰デジタルアリーナ',
    countryLabel: '国 🌐',
    languageLabel: '言語 💬',
    athleteTitle: 'アスリート',
    athleteQuote: '"アリーナを制覇せよ • 練習、試合、記録を披露"',
    athleteBtn: 'アリーナに入る →',
    fanTitle: 'ファン',
    fanQuote: '"最前列VIP • 無修正ライブ配信＆ギアレビュー"',
    fanBtn: '参加する →',
    scoutTitle: 'スカウト',
    scoutQuote: '"スカウティング • 記録を検証しチャンピオンをスカウト"',
    scoutBtn: 'タレントを探す →',
  }
};

const countries = [
  { label: '🇮🇳 India', value: 'India' },
  { label: '🇺🇸 USA', value: 'USA' },
  { label: '🇬🇧 UK', value: 'UK' },
  { label: '🇹🇭 Thailand', value: 'Thailand' },
  { label: '🇷🇺 Russia', value: 'Russia' },
  { label: '🇯🇵 Japan', value: 'Japan' },
  { label: '🇫🇷 France', value: 'France' },
  { label: '🇮🇹 Italy', value: 'Italy' },
  { label: '🇩🇪 Germany', value: 'Germany' },
  { label: '🇪🇸 Spain', value: 'Spain' },
  { label: '🇨🇦 Canada', value: 'Canada' },
  { label: '🇦🇺 Australia', value: 'Australia' },
  { label: '🇳🇿 New Zealand', value: 'New Zealand' },
  { label: '🇧🇷 Brazil', value: 'Brazil' },
  { label: '🇦🇷 Argentina', value: 'Argentina' },
  { label: '🇲🇽 Mexico', value: 'Mexico' },
  { label: '🇵🇭 Philippines', value: 'Philippines' },
];

const languages = [
  { label: 'English', value: 'English' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'French', value: 'French' },
  { label: 'Italian', value: 'Italian' },
  { label: 'German', value: 'German' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'Portuguese', value: 'Portuguese' },
  { label: 'Tagalog (Filipino)', value: 'Tagalog' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Thai', value: 'Thai' },
  { label: 'Russian', value: 'Russian' },
];

export default function RoleSelection({ selectedLang, setSelectedLang, onSelectRole }) {
  const t = dictionary[selectedLang] || dictionary.English;

  const [selectedCountry, setSelectedCountry] = useState('India');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  return (
    <View style={styles.outerGlowWrapper}>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {/* Top Main Brand Banner */}
        <View style={styles.logoSection}>
          <Image 
            source={require('./assets/bawaal_bolder_larger.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.tagline}>{t.tagline}</Text>
          <Text style={styles.subTitle}>{t.subTitle}</Text>
        </View>

        {/* Selectors Row */}
        <View style={styles.dropdownRow}>
          {/* Country Selector */}
          <View style={styles.dropdownBox}>
            <Text style={styles.dropdownLabel}>{t.countryLabel}</Text>
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setCountryModalVisible(true)}
            >
              <Text style={styles.pickerText}>
                {countries.find(c => c.value === selectedCountry)?.label || '🇮🇳 India'} ▼
              </Text>
            </TouchableOpacity>
          </View>

          {/* Language Selector */}
          <View style={styles.dropdownBox}>
            <Text style={styles.dropdownLabel}>{t.languageLabel}</Text>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => setLangModalVisible(true)}
            >
              <Text style={styles.pickerText}>{selectedLang} ▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. ATHLETE CARD */}
        <TouchableOpacity 
          style={[styles.card, styles.athleteCard]} 
          onPress={() => onSelectRole('athlete')}
          activeOpacity={0.85}
        >
          {/* Dense Cyber Grid Matrix */}
          <View style={styles.gridMatrix}>
            {[...Array(6)].map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridHorizontal, { borderColor: 'rgba(245, 158, 11, 0.22)' }]} />
            ))}
            <View style={styles.gridVerticalContainer}>
              {[...Array(6)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridVertical, { borderColor: 'rgba(245, 158, 11, 0.15)' }]} />
              ))}
            </View>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.athleteTitle}>{t.athleteTitle}</Text>
            <View style={styles.badgeContainer}>
              <Image 
                source={require('./assets/gold_belt.png')} 
                style={styles.badgeGraphic} 
                resizeMode="contain" 
              />
            </View>
          </View>

          <Text style={styles.cardQuote}>{t.athleteQuote}</Text>

          <View style={styles.btnWrapper}>
            <View style={styles.athleteBtn}>
              <Text style={styles.athleteBtnText}>{t.athleteBtn}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. FAN CARD */}
        <TouchableOpacity 
          style={[styles.card, styles.fanCard]} 
          onPress={() => onSelectRole('fan')}
          activeOpacity={0.85}
        >
          {/* Dense Cyber Grid Matrix */}
          <View style={styles.gridMatrix}>
            {[...Array(6)].map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridHorizontal, { borderColor: 'rgba(56, 189, 248, 0.22)' }]} />
            ))}
            <View style={styles.gridVerticalContainer}>
              {[...Array(6)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridVertical, { borderColor: 'rgba(56, 189, 248, 0.15)' }]} />
              ))}
            </View>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.fanTitle}>{t.fanTitle}</Text>
            <View style={styles.badgeContainer}>
              <Image 
                source={require('./assets/vip_ticket.png')} 
                style={styles.badgeGraphic} 
                resizeMode="contain" 
              />
            </View>
          </View>

          <Text style={styles.cardQuote}>{t.fanQuote}</Text>

          <View style={styles.btnWrapper}>
            <View style={styles.fanBtn}>
              <Text style={styles.fanBtnText}>{t.fanBtn}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 3. SCOUT CARD */}
        <TouchableOpacity 
          style={[styles.card, styles.scoutCard]} 
          onPress={() => onSelectRole('scout')}
          activeOpacity={0.85}
        >
          {/* Dense Cyber Grid Matrix */}
          <View style={styles.gridMatrix}>
            {[...Array(6)].map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridHorizontal, { borderColor: 'rgba(16, 185, 129, 0.22)' }]} />
            ))}
            <View style={styles.gridVerticalContainer}>
              {[...Array(6)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridVertical, { borderColor: 'rgba(16, 185, 129, 0.15)' }]} />
              ))}
            </View>
          </View>

          <View style={styles.cardHeader}>
            <Text style={styles.scoutTitle}>{t.scoutTitle}</Text>
            <View style={styles.badgeContainer}>
              <Image 
                source={require('./assets/radar_target.png')} 
                style={styles.badgeGraphic} 
                resizeMode="contain" 
              />
            </View>
          </View>

          <Text style={styles.cardQuote}>{t.scoutQuote}</Text>

          <View style={styles.btnWrapper}>
            <View style={styles.scoutBtn}>
              <Text style={styles.scoutBtnText}>{t.scoutBtn}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Country Selection Modal */}
        <Modal visible={countryModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <FlatList
                data={countries}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedCountry(item.value);
                      setCountryModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setCountryModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Language Selection Modal */}
        <Modal visible={langModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <FlatList
                data={languages}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedLang(item.value);
                      setLangModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setLangModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerGlowWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#0a0f1d',
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  logoImage: {
    width: 220,
    height: 100,
  },
  tagline: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginTop: -5,
  },
  subTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 15,
    lineHeight: 18,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 22,
  },
  dropdownBox: {
    width: '48%',
  },
  dropdownLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  pickerButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickerText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 13,
  },
  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    marginBottom: 18,
    backgroundColor: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  },
  gridMatrix: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    pointerEvents: 'none',
  },
  gridHorizontal: {
    borderBottomWidth: 1,
    width: '100%',
  },
  gridVerticalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  gridVertical: {
    borderRightWidth: 1,
    height: '100%',
  },
  athleteCard: {
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  fanCard: {
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  scoutCard: {
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    zIndex: 2,
  },
  athleteTitle: {
    color: '#f59e0b',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  fanTitle: {
    color: '#38bdf8',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scoutTitle: {
    color: '#10b981',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  badgeContainer: {
    width: 90,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeGraphic: {
    width: '100%',
    height: '100%',
  },
  cardQuote: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 18,
    lineHeight: 18,
    zIndex: 2,
  },
  btnWrapper: {
    alignItems: 'flex-end',
    zIndex: 2,
  },
  athleteBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  athleteBtnText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 12,
  },
  fanBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  fanBtnText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 12,
  },
  scoutBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  scoutBtnText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalOptionText: {
    color: '#38bdf8',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 15,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});