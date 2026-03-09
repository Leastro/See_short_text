const admin = require('firebase-admin');
const OpenAI = require("openai");

// 파이어베이스 초기화
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askChatGPT() {
  try {
    console.log("ChatGPT가 5개의 글을 생성 중입니다...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "너는 현대인의 문해력을 높여주는 전문 에디터이자 초단편 소설가야. 반드시 JSON 형식으로만 응답해."
        },
        {
          role: "user",
          content: "출근길에 1분 내외로 읽기 좋은 500자 내의 짧은 소설을 써줘. 장르, 주제는 자유롭게 선택해도 좋아."+
          "단, 작성 후 스스로 글을 읽어보고 논리적 오류나 문법적 오류가 없는지 꼭 확인해줘. 그리고 글의 내용이 이상하지 않고 자연스러운지 꼭 확인해줘."+
          "반드시 '이름을 가진 등장인물'이 등장하고, 사건이 시작되어 갈등을 겪고 해소되는 '기승전결'의 서사 구조를 갖춰야 해. " +
          "독자가 짧은 시간 안에 주인공의 상황에 몰입할 수 있도록 생생하게 묘사해줘. " +
          "글은 총 5개를 작성하는데, SF/판타지/로맨스/일상/스릴러/무협 등 서로 다른 장르로 겹치지 않게 작성하고 기존 만들었던 내용과 안 겹치도록 작성해줘."+
          "결과는 반드시 다음과 같은 JSON 키를 포함해야 해: " +
          "{ \"posts\": [ { \"title\": \"제목\", \"content\": \"본문\"} ] }"
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000
    });

    const responseContent = completion.choices[0].message.content;
    const rawData = JSON.parse(responseContent);

    // posts 키가 있고 배열인지 확인 후 반환
    if (rawData && Array.isArray(rawData.posts)) {
      console.log(`✅ ${rawData.posts.length}개의 글 생성 완료!`);
      return rawData.posts;
    } else {
      console.error("❌ 응답 형식이 올바르지 않습니다:", rawData);
      return null;
    }
  } catch (error) {
    console.error("❌ ChatGPT 에러:", error.message);
    return null;
  }
}

async function saveToFirebase() {
  // 파이어 베이스 연결 확인
  try {
    await db.collection('connection_test').doc('ping').set({ time: Date.now() });
    console.log("✅ 창고 문 확인 완료! 이제 글을 생성합니다.");
  } catch (e) {
    console.error("❌ 창고 문이 잠겨있어요! 토큰을 아끼기 위해 중단합니다.");
    return;
  }

  const postsArray = await askChatGPT();

  if (!postsArray || !Array.isArray(postsArray)) {
    console.error("⚠️ 저장할 데이터가 없거나 배열 형식이 아닙니다.");
    return;
  }

  try {
    for (const post of postsArray) {
      await db.collection('posts').add({
        title: post.title,
        content: post.content,
        topic: post.category || "일반", // category가 없을 경우 대비
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`📌 저장 완료: ${post.title}`);
    }
    console.log("🎉 모든 데이터가 파이어베이스에 성공적으로 저장되었습니다!");
  } catch (e) {
    console.error("❌ 파이어베이스 저장 실패:", e);
  }
}

saveToFirebase();