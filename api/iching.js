module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, text, title } = req.body || {};

  if (!name || !text || !title) {
    return res.status(400).json({ error: 'Missing name, title, or text parameter in JSON body' });
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set in environment variables' });
  }

  const systemMessage = `당신은 주역(易經) 판본학 및 한문 고전 주석학에 정통한 최고 권위의 동양고전학자입니다.
조선 정조대 『주역전의대전(周易傳義大全)』 및 송·당·위진 역대 정본 주석서에 기초하여 아래 원칙을 엄격히 준수하십시오:

[핵심 필수 규칙]
1. 한자 표기: 반드시 전통 번체자/정체자(繁體字/正字, Traditional Chinese)만 사용하십시오.
   - 중국 대륙의 간체자(简体字: 观, 传, 说, 从, 处, 国 등)는 절대로 단 한 글자도 사용하지 마십시오.
   - 예: 觀, 傳, 說, 從, 處, 國, 無, 陽, 陰 등 정자(正字)로만 표기하십시오.
2. 각 학자의 정확한 저작(書名) 정본 인용:
   - 왕필(王弼): 『주역주(周易注)』
   - 공영달(孔穎達): 『주역정의(周易正義)』 (왕필 주에 대한 정합적 疏)
   - 소식(蘇軾): 『동파역전(東坡易傳)』
   - 정이(程頤): 『이천역전(伊川易傳)』 (정씨역전)
   - 주희(朱熹): 『주역본의(周易本義)』
   - 쌍호호씨(胡炳文): 『주역본의통석(周易本義通釋)』
   - 운봉호씨(胡一桂): 『주역본의부록찬주(周易本義附錄纂注)』
3. 환각(지어내기) 원천 차단 규칙:
   - 각 학자의 문헌에 실재하는 정본 원문만 인용하십시오. 현대 백화문이나 AI가 임의로 작문한 가짜 한문을 절대로 생성하지 마십시오.
   - 만약 특정 효사에 대해 해당 학자의 저작에 독립적인 개별 주석이 수록되어 있지 않거나 전승 원문이 확실하지 않은 경우:
     * original에는 억지로 가짜 한문을 조작하지 말고, "[원문 미상 또는 주희 본의 계승]"이라고 정확히 명시하십시오.
     * translation에는 해당 학자의 학풍과 사상적 관점에 따른 고전학적 해설을 충실히 작성하십시오.
4. 번역 문체:
   - 한국고전번역원 스타일의 격조 높은 정통 번역을 수행하십시오.
   - 문장 종결어미는 반드시 품격 있는 평어체(해라체: '~이다', '~한다', '~다')를 사용하십시오. (~습니다 금지)`;

  const prompt = `주역 '${name}'의 '${title}' 구절입니다.

[원문]
${text}

위 구절에 대한 역대 7대 주석가의 정본 주석을 아래 JSON 형식으로 반환하십시오.
한문 원문(original)은 반드시 100% 번체 정자(繁體 正字)로 표기하고, 가짜 한문을 지어내지 마십시오.

{
  "title": "${title}",
  "wangbi":     { "book": "周易注", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "kongyingda": { "book": "周易正義", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "sushi":      { "book": "東坡易傳", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "chengyi":    { "book": "伊川易傳", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "zhuxi":      { "book": "周易本義", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "shuanghu":   { "book": "周易本義通釋", "original": "번체자 한문 원문", "translation": "한국어 번역" },
  "yunfeng":    { "book": "周易本義附錄纂注", "original": "번체자 한문 원문", "translation": "한국어 번역" }
}
오직 유효한 JSON 문자열만 반환하십시오.`;

  try {
    const openaiUrl = 'https://api.openai.com/v1/chat/completions';

    let response;
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      if (attempt === 2) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    const responseText = data.choices?.[0]?.message?.content?.trim() || '{}';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(responseText);
  } catch (error) {
    console.error('Iching API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
