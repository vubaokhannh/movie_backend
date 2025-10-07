// import { Injectable } from '@nestjs/common';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class EmailService {
//   private transporter: nodemailer.Transporter;

//   constructor() {
//     this.transporter = nodemailer.createTransport({
//       host: process.env.EMAIL_HOST,
//       port: parseInt(process.env.EMAIL_PORT),
//       secure: false,
//       auth: {
//         user: process.env.EMAIL_USERNAME,
//         pass: process.env.EMAIL_PASSWORD,
//       },
//     });
//   }

//   async sendMail(to: string, subject: string, text: string, html?: string) {
//     const mailOptions = {
//       from: `"User App" <${process.env.EMAIL_USERNAME}>`,
//       to,
//       subject,
//       text,
//       html,
//     };

//     try {
//       const info = await this.transporter.sendMail(mailOptions);
//       console.log('Email sent: %s', info.messageId);
//       return info;
//     } catch (error) {
//       console.error('Error sending email:', error);
//       throw error;
//     }
//   }
// }
