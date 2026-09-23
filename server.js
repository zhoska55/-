// 우리말샘(opendict.korean.go.kr) API 프록시 서버
// 역할: 인증 키를 서버에만 보관하고, 프런트엔드(게임)는 이 서버로만 요청한다.
//       -> 브라우저에 키가 노출되지 않고, CORS 문제도 사라진다(서버-서버 호출은 CORS 대상이 아님).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STDICT_KEY = process.env.STDICT_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // 배포 시 실제 게임이 서비스되는 도메인으로 좁히기

if (!STDICT_KEY) {
  console.error('STDICT_KEY가 설정되지 않았습니다. .env 파일에 STDICT_KEY=발급받은키 형태로 넣어 주세요.');
  process.exit(1);
}

app.use(cors({ origin: ALLOWED_ORIGIN }));

// public 폴더 안의 게임 화면(index.html)을 그대로 서빙한다.
// 배포 후에는 이 서버 주소 하나만 열면 게임과 사전 연동이 모두 된다.
app.use(express.static(path.join(__dirname, 'public')));

// 아주 단순한 메모리 캐시 (같은 단어 반복 조회 시 사전 서버 호출을 줄여 준다)
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24시간

app.get('/api/define', async (req, res) => {
  const word = (req.query.word || '').toString().trim();
  if (!word) {
    return res.status(400).json({ ok: false, error: 'word 쿼리 파라미터가 필요합니다.' });
  }

  const cached = cache.get(word);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json({ ok: true, source: 'cache', ...cached.data });
  }

  try {
    const url = `https://opendict.korean.go.kr/api/search?key=${encodeURIComponent(STDICT_KEY)}&q=${encodeURIComponent(word)}&req_type=json&num=10`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`사전 서버 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const item = data?.channel?.item?.[0];
    const sense = Array.isArray(item?.sense) ? item.sense[0] : item?.sense;

    if (!sense || !sense.definition) {
      return res.json({ ok: false, error: 'NOT_FOUND', word });
    }

    const result = {
      word,
      pos: sense.pos || '',
      definition: sense.definition
    };

    cache.set(word, { at: Date.now(), data: result });
    return res.json({ ok: true, source: 'stdict', ...result });

  } catch (err) {
    console.error('stdict 조회 실패:', err.message);
    return res.status(502).json({ ok: false, error: 'UPSTREAM_ERROR', message: err.message });
  }
});

// 구글 플레이 앱 연결(주소창 숨김)용
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.zhoska.korean_chosung_quiz',
      sha256_cert_fingerprints: [
        '92:39:99:4B:C9:FB:CB:E3:6C:37:63:99:5D:3D:F0:35:D2:A2:99:5B:23:E8:13:50:F0:3B:E7:E9:49:9D:97:95',
        'B4:3D:91:43:52:39:DC:82:3E:3A:0B:83:D4:61:66:01:72:E5:C3:2A:F5:50:55:36:76:42:28:AB:A4:F0:78:36'
      ]
    }
  }]);
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`사전 프록시 서버 실행 중: http://localhost:${PORT}`);
});
