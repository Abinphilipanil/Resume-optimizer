import { useNavigate } from "react-router-dom";

function ATSResult() {
  const navigate = useNavigate();
  const score = Math.floor(Math.random() * 100);
  const passed = score >= 70;

  return (
    <div className="page">
      <div className="page-content center">
        <h2>ATS Score</h2>

        <h1 style={{ marginBottom: "20px" }}>{score}%</h1>

        {passed ? (
          <>
            <p>Your resume is ATS friendly 🎉</p>
            <button
              className="btn-primary"
              onClick={() => navigate("/success")}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <p>Your resume needs improvement.</p>
            <button
              className="btn-outline"
              onClick={() => navigate("/chatbot")}
            >
              Improve with Chatbot
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ATSResult;
