# Chat

### A websockets based, real-time chat app written in TypeScript.

* Includes creating and joining a room, a profanity filter, anti-spam, and the
  ability to use Markdown (i.e bold text, emojis, and links).
* Uses Socket.io for event-driven, bi-directional communication, with Redis
  pub/sub.
* Uses Redis queues for persisting the 10 most recent messages, and hashmaps for
  storing the rooms and users.
* Uses HAProxy for load balancing and SSL/HTTPS
* Due to Redis pub/sub and HAProxy horizontal scaling is possible by scaling up
  the number of Docker containers and adding them to the haproxy.cfg file.
* Uses Node and Express for the server.
* Deployed to AWS EC2 using Terraform, the GitHub Actions workflow builds the
  Docker image, pushes it, and then pulls it on the EC2 instance.
