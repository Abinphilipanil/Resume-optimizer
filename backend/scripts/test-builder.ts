import axios from "axios";

async function run() {
  try {
    const res = await axios.post("http://localhost:8080/api/builder/build-from-links", {
      linkedin: "https://www.linkedin.com/in/abinphilipanil",
      github: "https://github.com/defunkt",
      jobDesc: "React Developer needed. Must have typescript experience.",
    });
    console.log("Success:", Object.keys(res.data));
    console.log("DB ID:", res.data.dbId);
  } catch (err: any) {
    if (err.response) {
      console.error("Error Response:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}
run();
