const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;
const BASE_URL = "http://20.244.56.144/evaluation-service";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQzNjA0Njg5LCJpYXQiOjE3NDM2MDQzODksImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6IjIwOWVmZTI3LWU4NjUtNGE5OC04NDNlLTlkYTk5NzU3YTI0MCIsInN1YiI6IjIyMDUyODA1QGtpaXQuYWMuaW4ifSwiZW1haWwiOiIyMjA1MjgwNUBraWl0LmFjLmluIiwibmFtZSI6ImFyc2hleSBtaXNocmEiLCJyb2xsTm8iOiIyMjA1MjgwNSIsImFjY2Vzc0NvZGUiOiJud3B3cloiLCJjbGllbnRJRCI6IjIwOWVmZTI3LWU4NjUtNGE5OC04NDNlLTlkYTk5NzU3YTI0MCIsImNsaWVudFNlY3JldCI6InVNRGtNTmdZTmpQYkJZUUoifQ.bajV3Novo4RIhbjsuO7G7WE7q7e780QozD5Ny8OGJ3U`,
    },
    timeout: 10000,
});

const userCache = {
    users: null,
    posts: {},
    comments: {},
};

const getUsers = async () => {
    if (userCache.users) return userCache.users;
    const response = await axiosInstance.get("/users");
    userCache.users = response.data.users;
    return userCache.users;
};

const getUserPosts = async (userId) => {
    if (userCache.posts[userId]) return userCache.posts[userId];
    const response = await axiosInstance.get(`/users/${userId}/posts`);
    userCache.posts[userId] = response.data.posts;
    return userCache.posts[userId];
};

const getPostCommentCount = async (postId) => {
    if (postId in userCache.comments) return userCache.comments[postId];
    const response = await axiosInstance.get(`/posts/${postId}/comments`);
    userCache.comments[postId] = response.data.comments.length;
    return userCache.comments[postId];
};

app.get("/users", async (req, res) => {
    try {
        const users = await getUsers();
        const postCounts = {};

        await Promise.all(
            Object.keys(users).map(async (userId) => {
                const posts = await getUserPosts(userId);
                postCounts[userId] = posts.length;
            })
        );

        const topUsers = Object.entries(postCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([userId]) => ({
                id: userId,
                name: users[userId],
                postCount: postCounts[userId],
            }));

        res.json(topUsers);
    } catch (error) {
        console.error("Error fetching top users:", error);
        res.status(500).json({ error: "Failed to fetch top users" });
    }
});

app.get("/posts", async (req, res) => {
    try {
        const { type } = req.query;
        if (!type || (type !== "latest" && type !== "popular")) {
            return res.status(400).json({ error: "Invalid type parameter. Use 'latest' or 'popular'." });
        }

        const users = await getUsers();
        let allPosts = [];
        await Promise.all(
            Object.keys(users).map(async (userId) => {
                const posts = await getUserPosts(userId);
                allPosts = allPosts.concat(posts);
            })
        );

        if (type === "latest") {
            return res.json(allPosts.sort((a, b) => b.id - a.id).slice(0, 5));
        } else {
            await Promise.all(
                allPosts.map(async (post) => {
                    if (!(post.id in userCache.comments)) {
                        userCache.comments[post.id] = await getPostCommentCount(post.id);
                    }
                })
            );

            const maxComments = Math.max(...Object.values(userCache.comments));
            const popularPosts = allPosts.filter(post => userCache.comments[post.id] === maxComments);

            return res.json(popularPosts);
        }
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
