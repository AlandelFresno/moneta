import { Component, OnInit } from '@angular/core';
import { OAuthRedirectMessage } from '../../services/google-auth.service';

@Component({
  selector: 'app-oauth-redirect',
  standalone: true,
  imports: [],
  templateUrl: './oauth-redirect.page.html',
  styleUrl: './oauth-redirect.page.scss'
})
export class OauthRedirectPage implements OnInit {
  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const message: OAuthRedirectMessage = {
      code: params.get('code') ?? undefined,
      error: params.get('error') ?? undefined
    };

    window.opener?.postMessage(message, window.location.origin);
    window.close();
  }
}
