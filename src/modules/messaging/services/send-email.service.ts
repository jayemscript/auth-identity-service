import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import sanitizeHtml from 'sanitize-html';

const MAX_BODY_BYTES = 64 * 1024;
const PLACEHOLDERS = new Set(['code','link','expiresAt','expiresInMinutes']);
const HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags:['html','head','meta','title','body','table','tbody','thead','tfoot','tr','td','th','div','span','p','br','hr','h1','h2','h3','strong','b','em','i','u','a','img','ul','ol','li'],
  allowedAttributes:{'*':['style','align','width','height','cellpadding','cellspacing','border','role'],a:['href','target'],img:['src','alt']},
  allowedSchemes:['https','mailto'], allowProtocolRelative:false,
  allowedSchemesAppliedToAttributes:['href','src'],
  allowedStyles:{'*':{'color':[/^#[0-9a-f]{3,8}$/i,/^[a-z]+$/i],'background-color':[/^#[0-9a-f]{3,8}$/i,/^[a-z]+$/i],'font-family':[/^[a-z0-9 ,"'-]+$/i],'font-size':[/^\d+(px|em|rem|%)$/],'font-weight':[/^(normal|bold|[1-9]00)$/],'text-align':[/^(left|right|center)$/],'line-height':[/^[\d.]+$/],'margin':[/^[\d.]+(px|em|rem|%)?$/],'padding':[/^[\d.]+(px|em|rem|%)?$/],'border':[/^[#\w .()-]+$/i],'max-width':[/^\d+(px|%)$/]}}
};

export interface SendEmailInput { to:string; subject:string; html:string; text?:string; values?:Partial<Record<'code'|'link'|'expiresAt'|'expiresInMinutes',string|number>>; }

@Injectable()
export class SendEmailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  constructor(config:ConfigService) {
    const host=config.getOrThrow<string>('SMTP_HOST'), port=Number(config.getOrThrow<string>('SMTP_PORT'));
    const secure=config.getOrThrow<string>('SMTP_SECURE');
    const user=config.getOrThrow<string>('SMTP_USER'), pass=config.getOrThrow<string>('SMTP_PASS');
    this.from=config.getOrThrow<string>('SMTP_FROM');
    if(!host.trim()||!user.trim()||!pass||!this.from.trim()||/[\r\n\x00-\x1f\x7f]/.test(this.from)||!Number.isInteger(port)||port<1||port>65535||!['true','false'].includes(secure)) throw new Error('SMTP configuration is invalid.');
    this.transporter=nodemailer.createTransport({host,port,secure:secure==='true',requireTLS:secure!=='true',auth:{user,pass}});
  }
  async execute(input:SendEmailInput) {
    if(!input.to||/[\r\n]/.test(input.to)||!input.subject||input.subject.length>200||/[\r\n\x00-\x1f\x7f]/.test(input.subject)) throw new BadRequestException('Email recipient or subject is invalid.');
    if(Buffer.byteLength(input.html,'utf8')+Buffer.byteLength(input.text??'','utf8')>MAX_BODY_BYTES) throw new BadRequestException('Email body exceeds 64 KiB.');
    const linkCount=(input.html.match(/{{\s*link\s*}}/g)??[]).length;
    const linkDestinationCount=(input.html.match(/href\s*=\s*(["']){{\s*link\s*}}\1/gi)??[]).length;
    if(linkCount!==linkDestinationCount) throw new BadRequestException('Email link placeholders must be the complete value of an href attribute.');
    const render=(source:string,html:boolean)=>source.replace(/{{\s*([^{}]+?)\s*}}/g,(_match,key:string)=>{
      if(!PLACEHOLDERS.has(key)) throw new BadRequestException('Email contains an unsupported placeholder.');
      const value=input.values?.[key as keyof SendEmailInput['values']]; if(value===undefined) throw new BadRequestException('Email placeholder value is missing.');
      if(key==='link') { let url:URL; try{url=new URL(String(value));}catch{throw new BadRequestException('Email link must be an HTTPS URL.');} if(url.protocol!=='https:') throw new BadRequestException('Email link must be an HTTPS URL.'); }
      const result=String(value); return html?result.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)):result;
    });
    const html=render(input.html,true), text=input.text===undefined?undefined:render(input.text,false);
    if(Buffer.byteLength(html,'utf8')+Buffer.byteLength(text??'','utf8')>MAX_BODY_BYTES) throw new BadRequestException('Rendered email body exceeds 64 KiB.');
    const safeHtml=sanitizeHtml(html,HTML_OPTIONS);
    try {
      const accepted=await this.transporter.sendMail({from:this.from,to:input.to,subject:input.subject,html:safeHtml,text,disableFileAccess:true,disableUrlAccess:true});
      return {accepted:accepted.accepted};
    } catch {
      throw new ServiceUnavailableException('Email delivery is temporarily unavailable.');
    }
  }
}
