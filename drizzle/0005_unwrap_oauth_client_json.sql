UPDATE `oauth_client` SET
	`scopes` = CASE WHEN json_type(`scopes`) = 'text' AND json_valid(json_extract(`scopes`, '$')) THEN json_extract(`scopes`, '$') ELSE `scopes` END,
	`contacts` = CASE WHEN json_type(`contacts`) = 'text' AND json_valid(json_extract(`contacts`, '$')) THEN json_extract(`contacts`, '$') ELSE `contacts` END,
	`redirect_uris` = CASE WHEN json_type(`redirect_uris`) = 'text' AND json_valid(json_extract(`redirect_uris`, '$')) THEN json_extract(`redirect_uris`, '$') ELSE `redirect_uris` END,
	`post_logout_redirect_uris` = CASE WHEN json_type(`post_logout_redirect_uris`) = 'text' AND json_valid(json_extract(`post_logout_redirect_uris`, '$')) THEN json_extract(`post_logout_redirect_uris`, '$') ELSE `post_logout_redirect_uris` END,
	`grant_types` = CASE WHEN json_type(`grant_types`) = 'text' AND json_valid(json_extract(`grant_types`, '$')) THEN json_extract(`grant_types`, '$') ELSE `grant_types` END,
	`response_types` = CASE WHEN json_type(`response_types`) = 'text' AND json_valid(json_extract(`response_types`, '$')) THEN json_extract(`response_types`, '$') ELSE `response_types` END,
	`metadata` = CASE WHEN json_type(`metadata`) = 'text' AND json_valid(json_extract(`metadata`, '$')) THEN json_extract(`metadata`, '$') ELSE `metadata` END;
