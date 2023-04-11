const express = require("express");
const bodyParser = require("body-parser");
const pg = require("pg");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(bodyParser.json());
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const verifyToken = require("./verifyToken");
const pool = require("./db");
const your_secret_key = require('./secret');

const router = express.Router();

// Registration
router.post("/register", (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Hash password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Insert user into database with hashed password
    pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, hash],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Internal server error" });
        }

        // Create JWT token with user ID and email as payload
        const token = jwt.sign(
          { id: result.insertId, email },
          "your_secret_key"
        );

        // Return JWT token
        return res.json({ token });
      }
    );
  });
});

// Authentication
router.post("/authenticate", (req, res) => {
  const { email, password } = req.body;

  pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      if (results.rows.length === 0) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const user = results.rows[0];

      bcrypt.compare(password, user.password, (error, result) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: "Internal Server Error" });
        }

        if (!result) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        // Create JWT token with user ID and email as payload
        const token = jwt.sign(
          { id: user.id, email: user.email },
          your_secret_key
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ token });
      });
    }
  );
});

// Follow
router.post("/follow/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  pool.query("SELECT * FROM users WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Internal Server Error");
    }

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const followerId = req.user.id;
    const followingId = id;

    pool.query(
      "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)",
      [followerId, followingId],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Internal Server Error");
        }

        return res.status(200).send("User followed successfully");
      }
    );
  });
});

// Unfollow
router.post("/unfollow/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  pool.query("SELECT * FROM users WHERE id = $1", [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Internal Server Error");
    }

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const followerId = req.user.id;
    const followingId = id;

    pool.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Internal Server Error");
        }

        return res.status(200).send("User unfollowed successfully");
      }
    );
  });
});

// Get User
router.get("/user", verifyToken, async (req, res) => {
  try {
    // Get the user profile data from the database
    const result = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [req.user.id]
    );
    const userProfile = result.rows[0]; // Assume the query returns one row

    // Get the number of followers from the database
    const followerResult = await pool.query(
      "SELECT COUNT(*) FROM follows WHERE following_id = $1",
      [req.user.id]
    );
    const numFollowers = followerResult.rows[0].count;

    // Get the number of followings from the database
    const followingResult = await pool.query(
      "SELECT COUNT(*) FROM follows WHERE follower_id = $1",
      [req.user.id]
    );
    const numFollowings = followingResult.rows[0].count;

    // Add the number of followers and followings to the user profile data
    userProfile.numFollowers = numFollowers;
    userProfile.numFollowings = numFollowings;

    // Return the user profile as JSON
    res.json(userProfile);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Update Username
router.put("/user/username", verifyToken, (req, res) => {
  const userId = req.user.id;
  const newUsername = req.body.username;

  // Update the username of the authenticated user
  pool.query(
    `UPDATE users SET username = $1 WHERE id = $2`,
    [newUsername, userId],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      } else {
        res.status(200).send("Username updated successfully");
      }
    }
  );
});

// Create Post
router.post("/posts", verifyToken, async (req, res) => {
  // 5. Parse the request body to extract the title and description.
  const { title, description } = req.body;

  // 6. Validate the input data to ensure it meets your requirements.
  if (!title || !description) {
    return res.status(400).send("Title and description are required");
  }

  try {
    // 7. Create a new post record in your database, including the post's title, description, and user ID.
    const result = await pool.query(
      "INSERT INTO posts (title, description, user_id) VALUES ($1, $2, $3) RETURNING id, title, description, created_at",
      [title, description, req.user.id]
    );

    // 8. Return a response to the client with the new post's ID, title, description, and created time (in UTC).
    const post = result.rows[0];
    res.send({
      postId: post.id,
      title: post.title,
      description: post.description,
      createdTime: post.created_at,
    });
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).send("Error creating post");
  }
});

// Delete the Post
router.delete("/posts/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      "DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.send("Post was successfully deleted.");
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Like a Post
router.post("/like/:id", verifyToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if the post exists
    const postResult = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);
    if (postResult.rowCount === 0) {
      throw new Error(`Post with ID ${postId} not found`);
    }

    // Check if the user has already liked the post
    const likeResult = await pool.query(
      "SELECT * FROM likes WHERE post_id = $1 AND user_id = $2",
      [postId, userId]
    );
    if (likeResult.rowCount > 0) {
      throw new Error(
        `User with ID ${userId} has already liked post with ID ${postId}`
      );
    }

    // Create a new like
    const likeQuery =
      "INSERT INTO likes (post_id, user_id) VALUES ($1, $2) RETURNING *";
    const likeValues = [postId, userId];
    const newLikeResult = await pool.query(likeQuery, likeValues);

    // Update the post's likes count
    const updateQuery =
      "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1";
    const updateValues = [postId];
    await pool.query(updateQuery, updateValues);

    res.json({
      success: true,
      like: newLikeResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
});

// Unlike a Post
router.post("/unlike/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;

  try {
    // Check if the user has liked the post
    const likeResult = await pool.query(
      "SELECT * FROM likes WHERE user_id = $1 AND post_id = $2",
      [userId, postId]
    );

    if (likeResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User has not liked this post",
      });
    }

    // Remove the user's like from the database
    await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [
      userId,
      postId,
    ]);

    // Decrement the like count for the post in the posts table
    await pool.query(
      "UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1",
      [postId]
    );

    return res.json({
      success: true,
      message: "Post unliked successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Add Comment
router.post("/comment/:id", verifyToken, async (req, res) => {
  const postId = req.params.id;
  const comment = req.body;
  const userId = req.user.id; // Assumes authenticated user ID is in req.user.id

  try {
    // Insert the new comment into the database
    const { rows } = await pool.query(
      "INSERT INTO comments (post_id, user_id, text) VALUES ($1, $2, $3) RETURNING id",
      [postId, userId, comment.text]
    );

    const commentId = rows[0].id;

    // Update the comments count in the posts table
    await pool.query(
      "UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1",
      [postId]
    );

    res.json({ commentId });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

// Get Post By ID
router.get("/posts/:id", (req, res) => {
  const postId = req.params.id;

  pool.query(
    "SELECT posts.*, COUNT(DISTINCT likes.id) AS likes_count, COUNT(DISTINCT comments.id) AS comments_count FROM posts LEFT JOIN likes ON likes.post_id = posts.id LEFT JOIN comments ON comments.post_id = posts.id WHERE posts.id = $1 GROUP BY posts.id",
    [postId],
    (error, result) => {
      if (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
        return;
      }

      if (result.rowCount === 0) {
        res.status(404).send("Post not found");
        return;
      }

      const post = result.rows[0];
      res.json(post);
    }
  );
});

// Get posts of Authenticated User
router.get("/all_posts", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // get the authenticated user's ID from the request
    const query = `
        SELECT p.id, p.title, p.description, p.created_at, 
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
          (SELECT JSON_AGG(c.*) FROM comments c WHERE c.post_id = p.id) AS comments
        FROM posts p
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC;
      `;
    const values = [userId];
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
