import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { FeedbackBoardService } from './feedback-board.service';
import { CreateCommentDto, CreatePostDto, QueryPostsDto, SimilarQueryDto } from './dto/feedback-board.dto';

/**
 * §feedback-plan §4 — public/authed board routes under /v1/feedback.
 * Browsing is open to any authenticated principal (incl. guests); the service
 * rejects guests on vote/post/comment/subscribe.
 *
 * Static sub-paths (`meta`, `similar`, `roadmap`) are declared before the
 * dynamic `posts/:ref` routes so they aren't shadowed by the param matcher.
 */
@Controller('feedback')
export class FeedbackBoardController {
  constructor(private readonly svc: FeedbackBoardService) {}

  @Get('meta')
  meta() {
    return this.svc.meta();
  }

  @Get('roadmap')
  roadmap() {
    return this.svc.roadmap();
  }

  @Get('similar')
  similar(@Query() q: SimilarQueryDto) {
    return this.svc.similar(q.q);
  }

  @Get('posts')
  list(@Query() q: QueryPostsDto) {
    return this.svc.list(q);
  }

  @Post('posts')
  create(@Body() dto: CreatePostDto) {
    return this.svc.createPost(dto);
  }

  @Get('posts/:ref')
  detail(@Param('ref', ParseIntPipe) ref: number) {
    return this.svc.detail(ref);
  }

  @Post('posts/:ref/vote')
  vote(@Param('ref', ParseIntPipe) ref: number) {
    return this.svc.vote(ref);
  }

  @Delete('posts/:ref/vote')
  unvote(@Param('ref', ParseIntPipe) ref: number) {
    return this.svc.unvote(ref);
  }

  @Post('posts/:ref/comments')
  comment(@Param('ref', ParseIntPipe) ref: number, @Body() dto: CreateCommentDto) {
    return this.svc.addComment(ref, dto);
  }

  @Post('posts/:ref/subscribe')
  subscribe(@Param('ref', ParseIntPipe) ref: number) {
    return this.svc.subscribe(ref);
  }

  @Delete('posts/:ref/subscribe')
  unsubscribe(@Param('ref', ParseIntPipe) ref: number) {
    return this.svc.unsubscribe(ref);
  }
}
