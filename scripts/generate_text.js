const admin = require('firebase-admin');
const OpenAI = require("openai");


// 파이어베이스 초기화 (Secrets에서 JSON 형태의 키를 가져온다)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function saveToFirebase() {
  const rawData = await askChatGPT(); // ChatGPT 호출 함수

  try {
    // 2. Firestore의 'posts' 컬렉션에 저장
    await db.collection('posts').add({
      title: rawData.title,
      content: rawData.content,
      topic: rawData.topic,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✅ 파이어베이스에 저장 완료!");
  } catch (e) {
    console.error("❌ 저장 실패:", e);
  }
}

// OpenAI 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 환경 변수에서 API 키 가져오기
});

async function askChatGPT() {
  try {
    console.log("ChatGPT가 글을 생성 중입니다...");

    // 채팅 요청 보내기
    const completion = await openai.chat.completions.create({
      // 모델 선택 (비용 효율적인 gpt-4o-mini 추천!)
      model: "gpt-4o-mini", 
      messages: [
        {
          role: "system",
          content: "너는 현대인의 문해력을 높여주는 전문 에디터야. 반드시 JSON 형식으로만 응답해."
        },
        {
          role: "user",
          content: "출근길에 1분 내외로 읽기 좋은 500자 내의 짧은 글을 써줘. 장르, 주제는 자유롭게 선택해도 좋아."+
          "단, 작성 후 스스로 글을 읽어보고 논리적 오류나 문법적 오류가 없는지 꼭 확인해줘. 그리고 글의 내용이 이상하지 않고 자연스러운지 꼭 확인해줘."+
          "글은 총 5개를 작성해주는데 기존 만들었던 내용과 안 겹치도록 작성해줘."+
          "결과는 반드시 다음과 같은 JSON 키를 포함해야 해: " +
           "{ \"title\": \"글 제목\", \"content\": \"본문 내용\", \"category\": \"장르/주제\" }"
        },
      ],
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    // 결과 파싱
    const rawData = JSON.parse(completion.choices[0].message.content);
    const postsArray = rawData.posts; // AI가 준 5개의 글 배열

    // 5개를 반복문 돌며 Firestore에 저장
    for (const post of postsArray) {
      await db.collection('posts').add({
        title: post.title,
        content: post.content,
        topic: post.category,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log(`✅ 총 ${postsArray.length}개의 글이 저장되었습니다!`);
    
    return rawData;
  } catch (error) {
    console.error("❌ 에러 발생:", error.message);
  }
}

//함수 실행
saveToFirebase();