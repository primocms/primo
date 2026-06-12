package internal

import (
	"net/url"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func RegisterPasswordLinkEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/primo/password-link", func(requestEvent *core.RequestEvent) error {
			body := struct {
				SiteId string `json:"site_id"`
				UserId string `json:"user_id"`
			}{}
			if err := requestEvent.BindBody(&body); err != nil {
				return err
			}
			if body.SiteId == "" {
				return requestEvent.BadRequestError("site_id missing", nil)
			}
			if body.UserId == "" {
				return requestEvent.BadRequestError("user_id missing", nil)
			}

			site, err := requestEvent.App.FindRecordById("sites", body.SiteId)
			if err != nil {
				return err
			}

			user, err := requestEvent.App.FindRecordById("users", body.UserId)
			if err != nil {
				return err
			}

			info, err := requestEvent.RequestInfo()
			if err != nil {
				return err
			}

			if canAccess, err := requestEvent.App.CanAccessRecord(site, info, user.Collection().ViewRule); !canAccess {
				return requestEvent.ForbiddenError("", err)
			}

			if canAccess, err := requestEvent.App.CanAccessRecord(user, info, user.Collection().ManageRule); !canAccess {
				return requestEvent.ForbiddenError("", err)
			}

			passwordResetToken, err := user.NewPasswordResetToken()
			if err != nil {
				return err
			}

			return requestEvent.JSON(200, struct {
				Link string `json:"link"`
			}{
				Link: "https://" + site.GetString("host") + "/admin/auth?create=" + passwordResetToken + "&email=" + url.QueryEscape(user.Email()),
			})
		})

		return serveEvent.Next()
	})

	return nil
}
