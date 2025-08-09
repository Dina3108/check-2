// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

const POINTS = {
  Easy: 10,
  Medium: 25,
  Hard: 50,
};
const DOUBLE_LANGS = new Set(["java", "cpp", "c"]);

async function fetchRecentSubmissions(username) {
  const query = `
    query recentAcSubmissions($username: String!) {
      recentAcSubmissionList(username: $username, limit: 50) {
        title
        titleSlug
        timestamp
        lang
      }
    }
  `;
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { username },
    }),
  });

  if (!response.ok) {
    return { error: `LeetCode API returned status ${response.status}` };
  }

  const data = await response.json();
  if (data.errors) {
    return { error: "Invalid username or API error" };
  }

  return data.data.recentAcSubmissionList;
}

async function fetchProblemDifficulty(titleSlug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { titleSlug },
    }),
  });

  if (!response.ok) return "Unknown";

  const data = await response.json();
  if (data.data && data.data.question) {
    return data.data.question.difficulty;
  }
  return "Unknown";
}

app.get("/leetcode", async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const submissions = await fetchRecentSubmissions(username);
    if (submissions.error) {
      return res.status(400).json({ error: submissions.error });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    const seenTitles = new Set();
    let easyCount = 0,
      mediumCount = 0,
      hardCount = 0,
      totalScore = 0;

    const results = [];

    for (const sub of submissions) {
      const subTime = Number(sub.timestamp) * 1000; // convert to ms
      if (subTime >= sevenDaysAgo && !seenTitles.has(sub.title)) {
        seenTitles.add(sub.title);
        const difficulty = await fetchProblemDifficulty(sub.titleSlug);

        if (difficulty === "Easy") easyCount++;
        else if (difficulty === "Medium") mediumCount++;
        else if (difficulty === "Hard") hardCount++;

        const basePoints = POINTS[difficulty] || 0;
        const langLower = sub.lang.toLowerCase();
        const points = [...DOUBLE_LANGS].some((lang) =>
          langLower.includes(lang)
        )
          ? basePoints * 2
          : basePoints;

        totalScore += points;

        results.push({
          title: sub.title,
          difficulty,
          language: sub.lang,
          time: new Date(subTime).toISOString().replace("T", " ").slice(0, 19),
          points,
        });
      }
    }

    return res.json({
      username,
      total_unique_solved: results.length,
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      total_score: totalScore,
      problems: results,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
