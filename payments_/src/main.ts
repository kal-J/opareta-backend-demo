import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { logger } from './common/logger/logger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AccessLoggerInterceptor } from './common/interceptors/access-logger.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });

  app.enableCors();

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global access logger interceptor
  app.useGlobalInterceptors(new AccessLoggerInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Payment Processing API')
    .setDescription('API documentation for payment processing service')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Payments', 'Payment processing endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3002);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3002}`,
  );
  console.log(
    `Swagger documentation: http://localhost:${process.env.PORT ?? 3002}/api/docs`,
  );
}
bootstrap();
